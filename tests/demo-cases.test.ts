import { describe, expect, it } from "vitest";
import { DEMO_CASES, getDemoResult } from "@/data/demo-cases";
import { deriveSafetyNotices, recommendImaging } from "@/lib/clinical/recommendation-engine";
import { createReportPdf } from "@/lib/report/pdf";
import { serviceForCase } from "@/services/analysis";
import { FusionService } from "@/services/fusion-service";
import { ReportService } from "@/services/report-service";
import { patientStudyKey } from "@/types/salifusion";
import type { AnalyzedStudy } from "@/types/salifusion";

describe("competition case library", () => {
  it("contains the eight requested deterministic educational scenarios", () => {
    expect(DEMO_CASES).toHaveLength(8);
    expect(DEMO_CASES.map((item) => item.id)).toEqual(["normal-anatomy", "distal-wharton-calculus", "occult-obstruction", "long-segment-stenosis", "sjogren-pattern", "kussmaul-like", "acute-suppurative", "focal-mass"]);
  });

  it("does not contain fabricated performance statistics", () => {
    const output = JSON.stringify(DEMO_CASES).toLowerCase();
    for (const forbidden of ["sensitivity", "specificity", "auc", "dice score", "accuracy"]) expect(output).not.toContain(forbidden);
  });

  it("labels every image source and every synthetic asset", () => {
    for (const item of DEMO_CASES) for (const asset of item.assets) {
      expect(asset.sourceLabel.length).toBeGreaterThan(15);
      if (asset.src.endsWith(".svg")) expect(asset.kind).toBe("synthetic-schematic");
    }
  });
});

describe("independent modality workflows", () => {
  it.each([
    ["distal-wharton-calculus", "ultrasound"],
    ["long-segment-stenosis", "sialography_2d"],
    ["long-segment-stenosis", "cbct_3d"],
  ] as const)("analyzes %s through its %s service without a prerequisite modality", async (caseId, modality) => {
    const demoCase = DEMO_CASES.find((item) => item.id === caseId)!;
    const output = await serviceForCase(demoCase, modality).analyze(demoCase, modality);
    expect(output.modality).toBe(modality);
    expect(output.observedFindings.length).toBeGreaterThan(0);
  });

  it("reports supported findings and missing evidence when phases are incomplete", () => {
    const demoCase = DEMO_CASES.find((item) => item.id === "distal-wharton-calculus")!;
    const result = getDemoResult(demoCase, "sialography_2d")!;
    expect(result.phasesAvailable).toEqual(["Ductal filling"]);
    expect(result.missingEvidence.join(" ")).toMatch(/evacuation/i);
  });
});

describe("adaptive recommendations and safety", () => {
  it("blocks routine contrast sialography during suspected acute suppurative infection", () => {
    const patient = DEMO_CASES.find((item) => item.id === "acute-suppurative")!.patient;
    expect(deriveSafetyNotices(patient).join(" ")).toMatch(/inappropriate/i);
    expect(recommendImaging(patient)[0]).toMatchObject({ modality: "Contrast sialography", priority: "Currently inappropriate" });
  });

  it("does not automatically route a Sjögren presentation to contrast sialography", () => {
    const patient = DEMO_CASES.find((item) => item.id === "sjogren-pattern")!.patient;
    expect(recommendImaging(patient)[0].modality).toMatch(/clinical \/ laboratory/i);
  });

  it("recommends dedicated ductal evaluation for Kussmaul-like symptoms", () => {
    const patient = DEMO_CASES.find((item) => item.id === "kussmaul-like")!.patient;
    expect(recommendImaging(patient)[0]).toMatchObject({ modality: "Dedicated ductal evaluation", priority: "Preferred" });
  });
});

describe("automatic fusion and reporting", () => {
  const demoCase = DEMO_CASES.find((item) => item.id === "occult-obstruction")!;
  const makeStudy = (modality: "ultrasound" | "sialography_2d"): AnalyzedStudy => ({ caseId: demoCase.id, modality, asset: demoCase.assets.find((item) => item.modality === modality)!, result: getDemoResult(demoCase, modality)!, patientKey: patientStudyKey(demoCase.patient) });

  it("activates predefined fusion when patient, gland, and laterality match", () => {
    const output = new FusionService().combine([makeStudy("ultrasound"), makeStudy("sialography_2d")]);
    expect(output.modality).toBe("multimodal");
    expect(output.assessment).toMatch(/stenosis occult on ultrasound/i);
  });

  it("rejects automatic fusion when identity or laterality does not match", () => {
    const second = { ...makeStudy("sialography_2d"), patientKey: "different|Parotid|Right" };
    expect(() => new FusionService().combine([makeStudy("ultrasound"), second])).toThrow(/same patient ID, gland, and laterality/i);
  });

  it("generates a downloadable PDF byte stream", () => {
    const studies = [makeStudy("ultrasound"), makeStudy("sialography_2d")];
    const result = new FusionService().combine(studies);
    const report = new ReportService().create(demoCase.patient, studies, result);
    const bytes = createReportPdf(report);
    expect(new TextDecoder().decode(bytes.slice(0, 8))).toBe("%PDF-1.4");
    expect(bytes.length).toBeGreaterThan(1000);
  });
});
