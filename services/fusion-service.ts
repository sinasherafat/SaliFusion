import { getDemoCase } from "@/data/demo-cases";
import type { AnalysisResult, AnalyzedStudy, Concordance } from "@/types/salifusion";

const unique = (items: string[]) => [...new Set(items)];

export class FusionService {
  canFuse(studies: AnalyzedStudy[]) {
    return studies.length > 1 && studies.every((study) => study.patientKey === studies[0].patientKey);
  }

  combine(studies: AnalyzedStudy[]): AnalysisResult {
    if (!studies.length) throw new Error("At least one analyzed modality is required.");
    if (studies.length === 1) return structuredClone(studies[0].result);
    if (!this.canFuse(studies)) throw new Error("Automatic fusion requires the same patient ID, gland, and laterality.");

    const sharedCase = studies.every((study) => study.caseId === studies[0].caseId) ? getDemoCase(studies[0].caseId) : null;
    if (sharedCase?.fusionResult) return structuredClone(sharedCase.fusionResult);

    return {
      caseId: `fusion:${studies.map((study) => study.caseId).join("+")}`,
      modality: "multimodal",
      isCuratedDemoCase: true,
      imageQuality: studies.every((study) => study.result.imageQuality === "Adequate") ? "Adequate" : "Limited",
      observedFindings: unique(studies.flatMap((study) => study.result.observedFindings)),
      patternInterpretations: ["Cross-modal correlation does not match a predefined paired educational scenario."],
      assessment: "Combined curated findings require clinician-led correlation",
      differentials: unique(studies.flatMap((study) => study.result.differentials)).slice(0, 4),
      supportingClinicalInformation: unique(studies.flatMap((study) => study.result.supportingClinicalInformation)),
      missingEvidence: unique(studies.flatMap((study) => study.result.missingEvidence)),
      limitations: ["The selected studies are not a predefined matched multimodal pair."],
      complementaryFindings: studies.map((study) => `${study.result.assessment} (${study.modality})`),
      conflictingFindings: ["No deterministic correspondence map is defined for this combination."],
      confidence: "Low",
      concordance: "Partial Concordance",
      recommendations: uniqueRecommendations(studies.flatMap((study) => study.result.recommendations)),
      safetyNotices: unique(studies.flatMap((study) => study.result.safetyNotices)),
      demoOnly: true,
    };
  }

  withConcordance(result: AnalysisResult, concordance: Concordance): AnalysisResult {
    if (result.modality !== "multimodal") return result;
    if (concordance === "Discordance Detected") return { ...result, concordance, confidence: "Low", conflictingFindings: ["The modality patterns do not support the same interpretation in this educational state."], assessment: "Cross-modal discordance requires clinician correlation" };
    if (concordance === "Partial Concordance") return { ...result, concordance, confidence: "Moderate", conflictingFindings: ["Only part of the imaging pattern is shared across modalities."] };
    return { ...result, concordance, confidence: result.confidence === "Low" ? "Moderate" : result.confidence, conflictingFindings: [] };
  }
}

function uniqueRecommendations(items: AnalysisResult["recommendations"]) {
  return items.filter((item, index) => items.findIndex((candidate) => candidate.modality === item.modality && candidate.priority === item.priority) === index);
}
