import { describe, expect, it } from "vitest";
import { COMPETITION_CASES, CORE_HISTORY_QUESTION_COUNT } from "@/data/competition-cases";
import { DEMO_MEDIA_SLOTS } from "@/data/demo-media";
import { DIAGNOSTIC_SUPPORT_SCORES, SCORE_DISCLAIMER } from "@/data/diagnostic-scores";
import { compatibleForFusion, examIdentity, getDuctalRecommendation, historyCompleteness } from "@/lib/clinical/competition-rules";
import { createCompetitionPdf } from "@/lib/report/competition-pdf";
import type { CaseId, GlandExam, SialographyPhase } from "@/types/competition";

const byId = (id: CaseId) => COMPETITION_CASES.find((item) => item.id === id)!;
const emptyExam = (side: "left" | "right" = "left"): GlandExam => ({ id: `exam-${side}`, gland: "parotid", side, reviewed: {}, clinicianVerified: {}, ultrasoundUploads: {}, phaseUploads: {}, cbctImages: [], dicomSeries: [], selectedSeriesUid: "", dicomError: "" });
const phaseIds: SialographyPhase[] = ["precontrast", "ductal", "acinar", "evacuation"];

describe("five-case competition fixture", () => {
  it("features exactly five separate clinical journeys", () => {
    expect(COMPETITION_CASES).toHaveLength(5);
    expect(COMPETITION_CASES.map((item) => item.id)).toEqual(["case-01", "case-02", "case-03", "case-04", "case-05"]);
    expect(new Set(COMPETITION_CASES.map((item) => `${item.history.gland}|${item.history.laterality}|${item.clinicalSummary}`)).size).toBe(5);
    expect(CORE_HISTORY_QUESTION_COUNT).toBe(30);
  });

  it("provides editable preset history without mutating the source", () => {
    for (const item of COMPETITION_CASES) {
      expect(Object.keys(item.history).length).toBeGreaterThan(35);
      const edited = { ...item.history, age: "99" };
      expect(edited.age).toBe("99");
      expect(item.history.age).not.toBe("99");
    }
  });

  it("preserves the original six media slots and adds optional Case 4 and required Case 5 imports", () => {
    const original = ["case-01-left-submandibular-bmode", "case-02-left-parotid-bmode-abnormal", "case-02-right-parotid-bmode-normal", "case-02-left-parotid-doppler-abnormal", "case-02-right-parotid-doppler-normal", "case-03-left-parotid-bmode"];
    expect(original.every((id) => DEMO_MEDIA_SLOTS.some((slot) => slot.id === id))).toBe(true);
    expect(DEMO_MEDIA_SLOTS.filter((slot) => slot.caseId === "case-02")).toHaveLength(4);
    expect(DEMO_MEDIA_SLOTS.some((slot) => slot.id === "case-04-provisional-left-submandibular-ultrasound")).toBe(true);
    expect(DEMO_MEDIA_SLOTS.some((slot) => slot.id === "case-05-right-submandibular-ultrasound")).toBe(true);
    expect(DEMO_MEDIA_SLOTS.every((slot) => slot.status === "awaiting-upload" && slot.mediaUrl === undefined)).toBe(true);
  });
});

describe("independent four-phase sialography source of truth", () => {
  it("gives every case a complete independent four-phase structure", () => {
    for (const item of COMPETITION_CASES) expect(Object.keys(item.sialographyPhases)).toEqual(phaseIds);
  });

  it("keeps Case 1 educational references separate and records an undocumented evacuation interval", () => {
    const item = byId("case-01");
    expect(item.sialography.observedFindings.every((finding) => finding.startsWith("Preset educational reference:"))).toBe(true);
    expect(item.sialographyPhases.evacuation.timing).toBe("Not Documented");
    expect(item.sialographyPhases.evacuation.interpretation).toMatch(/Delayed clearance cannot be concluded/i);
  });

  it("preserves Case 2 B-mode/Doppler comparison and records that sialography was not performed", () => {
    const item = byId("case-02");
    expect(item.ultrasound.observedFindings.join(" ")).toMatch(/hypoechoic.*hypervascularity.*right parotid/i);
    expect(Object.values(item.sialographyPhases).every((phase) => phase.availability === "not-provided")).toBe(true);
  });

  it("keeps Case 3 ultrasound normal while separating normal main duct and abnormal peripheral findings", () => {
    const item = byId("case-03");
    expect(item.ultrasound.interpretation).toMatch(/no definite sonographic parenchymal abnormality/i);
    expect(item.ultrasound.observedFindings.join(" ")).not.toMatch(/heterogeneity|hypoechoic/i);
    expect(item.sialographyPhases.ductal.interpretation).toMatch(/Normal Main Duct Architecture/i);
    expect(item.sialographyPhases.acinar.findings.join(" ")).toMatch(/Peripheral Punctate Sialectasis/i);
  });

  it("supports Case 4 as sialography-only with negative scout, positive filling defect, and five-minute delay", () => {
    const item = byId("case-04");
    expect(item.ultrasound.observedFindings).toHaveLength(0);
    expect(item.sialographyPhases.precontrast.interpretation).toMatch(/negative scout does not exclude/i);
    expect(item.sialographyPhases.ductal.findings.join(" ")).toMatch(/filling defect/i);
    expect(item.sialographyPhases.evacuation.timing).toBe("Five minutes");
    expect(item.sialographyPhases.evacuation.interpretation).toMatch(/incomplete contrast evacuation at five minutes/i);
  });

  it("configures Case 5 laterality, mass effect, three-minute clearance, and further-imaging recommendations", () => {
    const item = byId("case-05");
    expect(item.history).toMatchObject({ age: "42", sex: "male", gland: "submandibular", laterality: "right", palpableMass: "yes" });
    expect(item.sialographyPhases.precontrast.availability).toBe("not-provided");
    expect(item.sialographyPhases.acinar.findings.join(" ")).toMatch(/ductal displacement.*ductal splaying/i);
    expect(item.sialographyPhases.evacuation.timing).toBe("Three minutes");
    expect(item.sialography.recommendations.join(" ")).toMatch(/Targeted Ultrasound.*Color\/Power Doppler.*MRI of the Neck/i);
  });
});

describe("dynamic safety and identity rules", () => {
  it("derives Case 2 defer status from history rather than case ID", () => {
    const acute = byId("case-02").history;
    expect(getDuctalRecommendation("case-02", acute).state).toBe("defer");
    const resolved = { ...acute, onset: "gradual" as const, pain: "no" as const, rednessWarmth: "no" as const, fever: "no" as const, purulentDischarge: "no" as const, acuteSuppurativeConcern: "no" as const };
    expect(getDuctalRecommendation("case-02", resolved).state).toBe("appropriate");
  });

  it("responds to new safety information in any case", () => {
    const history = { ...byId("case-04").history, acuteSuppurativeConcern: "yes" as const };
    expect(getDuctalRecommendation("case-04", history).state).toBe("defer");
  });

  it("retains impacted-stone and mass-effect precautions", () => {
    expect(getDuctalRecommendation("case-01", { ...byId("case-01").history, impactedDistalStone: "yes" }).explanation).toMatch(/displace/i);
    expect(getDuctalRecommendation("case-05", byId("case-05").history)).toMatchObject({ state: "precaution" });
  });

  it("calculates thirty-question completeness and preserves left/right identities", () => {
    expect(historyCompleteness(byId("case-01").history).total).toBe(30);
    expect(examIdentity(emptyExam("left"))).not.toBe(examIdentity(emptyExam("right")));
  });
});

describe("fusion, provenance, and reports", () => {
  it("requires two reviewed modalities on one gland record", () => {
    expect(compatibleForFusion([{ ...emptyExam(), reviewed: { ultrasound: true, sialography: true } }], ["ultrasound", "sialography"])).toBe(true);
    expect(compatibleForFusion([{ ...emptyExam(), reviewed: { sialography: true } }], ["sialography"])).toBe(false);
    expect(byId("case-04").fusion.limitations.join(" ")).toMatch(/no artificial second-modality/i);
  });

  it("labels all scores as illustrative and does not claim clinical accuracy", () => {
    expect(SCORE_DISCLAIMER).toBe("Illustrative Diagnostic Support Score — Not Clinically Validated");
    const serialized = JSON.stringify(DIAGNOSTIC_SUPPORT_SCORES).toLowerCase();
    expect(serialized).not.toContain("accuracy");
  });

  it("does not transfer preset diagnoses to unrelated uploads", () => {
    expect(DEMO_MEDIA_SLOTS.every((slot) => slot.mediaUrl === undefined && slot.status === "awaiting-upload")).toBe(true);
    expect(byId("case-05").ultrasound.observedFindings).toHaveLength(0);
    expect(byId("case-05").ultrasound.interpretation).toMatch(/No ultrasound findings are manufactured/i);
  });

  it.each(["ultrasound", "sialography", "cbct", "fusion", "complete"] as const)("generates a %s PDF", (kind) => {
    const demoCase = byId("case-05");
    const exam = { ...emptyExam("right"), gland: "submandibular" as const, reviewed: { ultrasound: true, sialography: true }, phaseUploads: { ductal: { name: "ductal.png", url: "blob:test", objectUrl: true as const } } };
    const bytes = createCompetitionPdf({ kind, demoCase, history: demoCase.history, exam, includedModalities: ["ultrasound", "sialography"], scores: demoCase.scores });
    expect(new TextDecoder().decode(bytes.slice(0, 8))).toBe("%PDF-1.4");
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("includes all phase interpretations and timing in the sialography PDF", () => {
    const demoCase = byId("case-04");
    const bytes = createCompetitionPdf({ kind: "sialography", demoCase, history: demoCase.history, exam: { ...emptyExam(), gland: "submandibular" }, includedModalities: ["sialography"] });
    const text = new TextDecoder().decode(bytes);
    expect(text).toMatch(/SCOUT \/ PRECONTRAST/);
    expect(text).toMatch(/DUCTAL FILLING/);
    expect(text).toMatch(/ACINAR \/ PARENCHYMAL FILLING/);
    expect(text).toMatch(/EVACUATION - FIVE MINUTES/);
  });
});
