import type { AnalysisResult, Concordance } from "@/types/salifusion";

export class FusionService {
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
      return { ...result, concordance, confidence: "Moderate", conflictingFindings: ["Only part of the imaging pattern is shared across modalities."] };
    }
    return { ...result, concordance, confidence: "High", conflictingFindings: [] };
  }
}
