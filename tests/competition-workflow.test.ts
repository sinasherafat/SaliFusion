import { describe, expect, it } from "vitest";
import { COMPETITION_CASES, CORE_HISTORY_QUESTION_COUNT } from "@/data/competition-cases";
import { DEMO_MEDIA_SLOTS } from "@/data/demo-media";
import { DIAGNOSTIC_SUPPORT_SCORES, SCORE_DISCLAIMER } from "@/data/diagnostic-scores";
import { compatibleForFusion, examIdentity, getDuctalRecommendation, historyCompleteness } from "@/lib/clinical/competition-rules";
import { createCompetitionPdf } from "@/lib/report/competition-pdf";
import type { GlandExam } from "@/types/competition";

const emptyExam = (side: "left" | "right" = "left"): GlandExam => ({ id: `exam-${side}`, gland: "parotid", side, reviewed: {}, clinicianVerified: {}, ultrasoundUploads: {}, phaseUploads: {}, cbctImages: [], dicomSeries: [], selectedSeriesUid: "", dicomError: "" });

describe("three-case competition fixture", () => {
  it("features exactly the three requested clinical journeys", () => {
    expect(COMPETITION_CASES).toHaveLength(3);
    expect(COMPETITION_CASES.map((item) => item.id)).toEqual(["case-01", "case-02", "case-03"]);
    expect(CORE_HISTORY_QUESTION_COUNT).toBe(30);
  });

  it("provides editable, explicit history answers for every case", () => {
    for (const item of COMPETITION_CASES) {
      expect(Object.keys(item.history).length).toBeGreaterThan(35);
      const edited = { ...item.history, age: "99" };
      expect(edited.age).toBe("99");
      expect(item.history.age).not.toBe("99");
    }
  });

  it("contains exactly six named ultrasound slots with the case-two comparison quartet", () => {
    expect(DEMO_MEDIA_SLOTS).toHaveLength(6);
    expect(DEMO_MEDIA_SLOTS.every((slot) => slot.status === "awaiting-upload")).toBe(true);
    expect(DEMO_MEDIA_SLOTS.filter((slot) => slot.caseId === "case-02")).toHaveLength(4);
    expect(new Set(DEMO_MEDIA_SLOTS.map((slot) => slot.id)).size).toBe(6);
  });
});

describe("evidence-aware recommendation rules", () => {
  it("allows conditional ductal mapping for case one without auto-requiring it", () => {
    const recommendation = getDuctalRecommendation("case-01", COMPETITION_CASES[0].history);
    expect(recommendation.state).toBe("appropriate");
    expect(recommendation.explanation).toMatch(/only when the result would influence/i);
  });

  it("adds the impacted distal-stone precaution", () => {
    const history = { ...COMPETITION_CASES[0].history, impactedDistalStone: "yes" as const };
    expect(getDuctalRecommendation("case-01", history)).toMatchObject({ state: "precaution" });
    expect(getDuctalRecommendation("case-01", history).explanation).toMatch(/displace/i);
  });

  it("blocks a recommend-now contrast path for the acute case without disabling prior-image review", () => {
    const recommendation = getDuctalRecommendation("case-02", COMPETITION_CASES[1].history);
    expect(recommendation.state).toBe("defer");
    expect(recommendation.title).toMatch(/Not Appropriate at This Stage/i);
    expect(recommendation.considerations.join(" ")).toMatch(/previously acquired images may still be reviewed/i);
  });

  it("keeps Sjögren-related ductal imaging selective", () => {
    const recommendation = getDuctalRecommendation("case-03", COMPETITION_CASES[2].history);
    expect(recommendation.state).toBe("precaution");
    expect(recommendation.explanation).toMatch(/not obligatory/i);
  });

  it("calculates completeness from thirty core questions", () => {
    const output = historyCompleteness(COMPETITION_CASES[0].history);
    expect(output.total).toBe(30);
    expect(output.completed).toBeLessThanOrEqual(30);
  });
});

describe("fusion, scores, and reporting", () => {
  it("requires two reviewed modalities on one gland record", () => {
    const exam = { ...emptyExam(), reviewed: { ultrasound: true, sialography: true } };
    expect(compatibleForFusion([exam], ["ultrasound", "sialography"])).toBe(true);
    expect(compatibleForFusion([exam], ["ultrasound"])).toBe(false);
  });

  it("keeps left and right gland identities distinct", () => {
    expect(examIdentity(emptyExam("left"))).not.toBe(examIdentity(emptyExam("right")));
  });

  it("labels every deterministic score as illustrative and never as accuracy", () => {
    expect(SCORE_DISCLAIMER).toMatch(/illustrative and not clinically validated/i);
    const serialized = JSON.stringify(DIAGNOSTIC_SUPPORT_SCORES).toLowerCase();
    expect(serialized).not.toContain("accuracy");
    expect(Object.values(DIAGNOSTIC_SUPPORT_SCORES).every((scores) => scores.every((item) => item.rationale.length > 20))).toBe(true);
  });

  it.each(["ultrasound", "sialography", "cbct", "fusion", "complete"] as const)("generates a %s PDF", (kind) => {
    const demoCase = COMPETITION_CASES[0]; const exam = { ...emptyExam(), gland: "submandibular" as const, reviewed: { ultrasound: true, sialography: true } };
    const bytes = createCompetitionPdf({ kind, demoCase, history: demoCase.history, exam, includedModalities: ["ultrasound", "sialography"], scores: demoCase.scores });
    expect(new TextDecoder().decode(bytes.slice(0, 8))).toBe("%PDF-1.4");
    expect(bytes.length).toBeGreaterThan(1000);
  });
});
