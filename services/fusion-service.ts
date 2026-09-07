import { getDemoCase } from "@/data/demo-cases";
import type { AnalysisResult, AnalyzedStudy, Concordance } from "@/types/salifusion";

function unique(items: string[]) {
  return [...new Set(items)];
}

export class FusionService {
  combine(studies: AnalyzedStudy[]): AnalysisResult {
    if (!studies.length) throw new Error("At least one analyzed modality is required.");
    if (studies.length === 1) return structuredClone(studies[0].result);

    const sharedCase = studies.every((study) => study.caseId === studies[0].caseId) ? getDemoCase(studies[0].caseId) : null;
    if (sharedCase?.fusionResult) return structuredClone(sharedCase.fusionResult);

    const isSjogrenPair = studies.every((study) => study.caseId.startsWith("sjogren"));
    const modalities = studies.map((study) => study.modality).join("+");
    return {
      caseId: `fusion:${modalities}`,
      modality: "multimodal",
      isCuratedDemoCase: true,
      imageQuality: studies.every((study) => study.result.imageQuality === "Adequate") ? "Adequate" : "Limited",
      findings: studies.flatMap((study) => study.result.findings),
      assessment: isSjogrenPair
        ? "Integrated Sjögren-related parenchymal and ductal pattern"
        : "Combined curated findings require clinician-led cross-modal correlation",
      differentials: unique(studies.flatMap((study) => study.result.differentials)).slice(0, 2),
      supportingFeatures: unique(studies.flatMap((study) => study.result.supportingFeatures)),
      complementaryFindings: studies.map((study) => `${study.result.assessment} (${study.modality})`),
      conflictingFindings: isSjogrenPair ? [] : ["The selected curated studies do not represent a predefined matched clinical pair."],
      confidence: isSjogrenPair ? "High" : "Moderate",
      concordance: isSjogrenPair ? "High Concordance" : "Partial Concordance",
      additionalImagingRecommendation: isSjogrenPair
        ? "No additional modality is required for this integrated curated demonstration."
        : "No automated recommendation is made for this unmatched curated pairing; clinician correlation is recommended.",
      demoOnly: true,
    };
  }

  withConcordance(result: AnalysisResult, concordance: Concordance): AnalysisResult {
    if (result.modality !== "multimodal") return result;
    if (concordance === "Discordance Detected") {
      return {
        ...result,
        concordance,
        confidence: "Low",
        conflictingFindings: ["The two modality patterns do not support the same interpretation in this demonstration state."],
        assessment: "Cross-modal discordance requires clinician correlation",
      };
    }
    if (concordance === "Partial Concordance") {
      return {
        ...result,
        concordance,
        confidence: "Moderate",
        conflictingFindings: ["Only part of the imaging pattern is shared across modalities."],
      };
    }
    return { ...result, concordance, confidence: "High", conflictingFindings: [] };
  }
}
