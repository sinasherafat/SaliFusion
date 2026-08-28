import { describe, expect, it } from "vitest";
import { DEMO_CASES } from "@/data/demo-cases";
import { serviceForCase } from "@/services/analysis";
import { FusionService } from "@/services/fusion-service";
import { ReportService } from "@/services/report-service";

describe("curated SaliFusion demonstration cases", () => {
  it("contains the six required cases without fabricated performance metrics", () => {
    expect(DEMO_CASES).toHaveLength(6);
    const output = JSON.stringify(DEMO_CASES).toLowerCase();
    for (const forbidden of ["sensitivity", "specificity", "auc", "dice score", "accuracy"]) expect(output).not.toContain(forbidden);
  });

  it("keeps differentials to a maximum of two", () => {
    for (const item of DEMO_CASES) expect(item.result.differentials.length).toBeLessThanOrEqual(2);
  });

  it("supports ultrasound sufficiency and sialography-dominant logic", () => {
    expect(DEMO_CASES.find((item) => item.id === "sialolith-ultrasound")?.result.recommendation).toMatch(/sufficient/i);
    expect(DEMO_CASES.find((item) => item.id === "sialolith-sialography")?.result.recommendation).toMatch(/informative/i);
  });

  it("returns structured simulated results through modality services", async () => {
    const item = DEMO_CASES[3];
    const result = await serviceForCase(item).analyze(item);
    expect(result.caseId).toBe(item.id);
    expect(result.isCuratedDemoCase).toBe(true);
    expect(result.demoOnly).toBe(true);
  });
});

describe("fusion and report layers", () => {
  const multimodal = DEMO_CASES[0].result;

  it("lowers confidence and exposes discordance", () => {
    const result = new FusionService().withConcordance(multimodal, "Discordance Detected");
    expect(result.confidence).toBe("Low");
    expect(result.concordance).toBe("Discordance Detected");
    expect(result.conflictingFindings?.length).toBeGreaterThan(0);
  });

  it("creates and reviews an integrated report", () => {
    const service = new ReportService();
    const report = service.create({ patientId: "DEMO-01", age: "47", sex: "Female", gland: "Parotid", side: "Left", symptoms: ["Swelling"] }, multimodal);
    const reviewed = service.review(report, "Accepted", "Reviewed by clinician.");
    expect(reviewed.reviewDecision).toBe("Accepted");
    expect(reviewed.clinicianNote).toMatch(/clinician/);
  });
});
