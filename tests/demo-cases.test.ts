import { describe, expect, it } from "vitest";
import { DEMO_CASES, findCuratedAsset, getDemoResult } from "@/data/demo-cases";
import { serviceForCase } from "@/services/analysis";
import { FusionService } from "@/services/fusion-service";
import { ReportService } from "@/services/report-service";
import type { AnalyzedStudy, PatientInfo } from "@/types/salifusion";

describe("curated SaliFusion demonstration cases", () => {
  it("contains six clinical cases without fabricated performance metrics", () => {
    expect(DEMO_CASES).toHaveLength(6);
    const output = JSON.stringify(DEMO_CASES).toLowerCase();
    for (const forbidden of ["sensitivity", "specificity", "auc", "dice score", "accuracy"]) expect(output).not.toContain(forbidden);
  });

  it("keeps differentials concise and gives every packaged result an imaging recommendation", () => {
    for (const item of DEMO_CASES) {
      const results = [item.result, ...Object.values(item.modalityResults ?? {}), ...(item.fusionResult ? [item.fusionResult] : [])];
      for (const result of results) {
        expect(result.differentials.length).toBeLessThanOrEqual(2);
        expect(result.additionalImagingRecommendation.length).toBeGreaterThan(10);
      }
    }
  });

  it("supports the specified single-modality recommendation logic", () => {
    expect(DEMO_CASES.find((item) => item.id === "sialolith-ultrasound")?.result.additionalImagingRecommendation).toMatch(/no additional imaging/i);
    expect(DEMO_CASES.find((item) => item.id === "sjogren-2d")?.result.additionalImagingRecommendation).toMatch(/may not be necessary/i);
    expect(DEMO_CASES.find((item) => item.id === "sjogren-cbct")?.result.additionalImagingRecommendation).toMatch(/no additional modality/i);
  });

  it("recognizes exact curated filenames only within the selected modality", () => {
    expect(findCuratedAsset("ball-in-hand-sialography.jpg", "sialography_2d")?.demoCase.id).toBe("space-occupying-lesion");
    expect(findCuratedAsset("tumor-ultrasound.jpg", "ultrasound")?.demoCase.id).toBe("space-occupying-lesion");
    expect(findCuratedAsset("unknown.png", "ultrasound")).toBeNull();
    expect(findCuratedAsset("tumor-ultrasound.jpg", "sialography_2d")).toBeNull();
  });

  it("returns a structured simulated result through the selected modality service", async () => {
    const item = DEMO_CASES[3];
    const result = await serviceForCase(item, item.modality).analyze(item, item.modality);
    expect(result.caseId).toBe(item.id);
    expect(result.isCuratedDemoCase).toBe(true);
    expect(result.demoOnly).toBe(true);
  });
});

describe("automatic fusion and report layers", () => {
  const demoCase = DEMO_CASES[0];
  const sialography = getDemoResult(demoCase, "sialography_2d");
  const ultrasound = getDemoResult(demoCase, "ultrasound");
  if (!sialography || !ultrasound) throw new Error("Expected paired curated results.");
  const studies: AnalyzedStudy[] = [
    { caseId: demoCase.id, modality: "sialography_2d", asset: demoCase.assets[0], result: sialography },
    { caseId: demoCase.id, modality: "ultrasound", asset: demoCase.assets[1], result: ultrasound },
  ];

  it("automatically creates the predefined high-concordance fusion result", () => {
    const result = new FusionService().combine(studies);
    expect(result.modality).toBe("multimodal");
    expect(result.concordance).toBe("High Concordance");
    expect(result.assessment).toMatch(/space-occupying/i);
  });

  it("can demonstrate discordance without changing the input studies", () => {
    const base = new FusionService().combine(studies);
    const result = new FusionService().withConcordance(base, "Discordance Detected");
    expect(result.confidence).toBe("Low");
    expect(result.concordance).toBe("Discordance Detected");
    expect(result.conflictingFindings?.length).toBeGreaterThan(0);
  });

  it("carries patient history and every analyzed modality into the report", () => {
    const patient: PatientInfo = { patientName: "Demo Patient", patientId: "DEMO-01", age: "47", sex: "Female", gland: "Parotid", side: "Left", symptoms: ["Swelling"], clinicalNotes: "Painless recurrent swelling." };
    const service = new ReportService();
    const report = service.create(patient, studies, new FusionService().combine(studies));
    const reviewed = service.review(report, "Accepted", "Reviewed by clinician.");
    expect(reviewed.studies).toHaveLength(2);
    expect(reviewed.clinicalInformation).toContain("Painless recurrent swelling.");
    expect(reviewed.reviewDecision).toBe("Accepted");
  });
});
