import { getDemoCase } from "@/data/demo-cases";
import type { AnalysisResult, DemoCase } from "@/types/salifusion";

export interface AnalysisService {
  analyze(demoCase: DemoCase): Promise<AnalysisResult>;
}

async function curatedResult(demoCase: DemoCase, expected: DemoCase["modality"][]) {
  if (!expected.includes(demoCase.modality)) throw new Error("This case is not compatible with the selected analysis service.");
  const stored = getDemoCase(demoCase.id);
  if (!stored) throw new Error("Curated demonstration result not found.");
  await new Promise((resolve) => globalThis.setTimeout(resolve, 650));
  return structuredClone(stored.result);
}

export class UltrasoundAnalysisService implements AnalysisService {
  analyze(demoCase: DemoCase) { return curatedResult(demoCase, ["ultrasound"]); }
}

export class SialographyAnalysisService implements AnalysisService {
  analyze(demoCase: DemoCase) { return curatedResult(demoCase, ["sialography_2d", "cbct_3d"]); }
}

export class MultimodalAnalysisService implements AnalysisService {
  analyze(demoCase: DemoCase) { return curatedResult(demoCase, ["multimodal"]); }
}

export function serviceForCase(demoCase: DemoCase): AnalysisService {
  if (demoCase.modality === "ultrasound") return new UltrasoundAnalysisService();
  if (demoCase.modality === "multimodal") return new MultimodalAnalysisService();
  return new SialographyAnalysisService();
}
