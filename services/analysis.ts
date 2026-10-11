import { getDemoCase, getDemoResult } from "@/data/demo-cases";
import type { AnalysisResult, DemoCase, Modality } from "@/types/salifusion";

export interface AnalysisService {
  analyze(demoCase: DemoCase, modality: Modality): Promise<AnalysisResult>;
}

async function curatedResult(demoCase: DemoCase, modality: Modality, expected: Modality[]) {
  if (!expected.includes(modality)) throw new Error("This case is not compatible with the selected analysis service.");
  const stored = getDemoCase(demoCase.id);
  if (!stored) throw new Error("Curated demonstration result not found.");
  const result = getDemoResult(stored, modality);
  if (!result) throw new Error("No predefined result is packaged for this modality and curated case.");
  await new Promise((resolve) => globalThis.setTimeout(resolve, 650));
  return structuredClone(result);
}

export class UltrasoundAnalysisService implements AnalysisService {
  analyze(demoCase: DemoCase, modality: Modality) { return curatedResult(demoCase, modality, ["ultrasound"]); }
}

export class SialographyAnalysisService implements AnalysisService {
  analyze(demoCase: DemoCase, modality: Modality) { return curatedResult(demoCase, modality, ["sialography_2d", "cbct_3d"]); }
}

export function serviceForCase(_demoCase: DemoCase, modality: Modality): AnalysisService {
  if (modality === "ultrasound") return new UltrasoundAnalysisService();
  return new SialographyAnalysisService();
}
