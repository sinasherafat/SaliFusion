import type { CaseId, ClinicalModality, GlandExam, HistoryAnswers } from "@/types/competition";

export type RecommendationState = "appropriate" | "precaution" | "defer";

export interface DuctalRecommendation {
  state: RecommendationState;
  title: string;
  explanation: string;
  considerations: string[];
}

export function getDuctalRecommendation(caseId: CaseId, history: HistoryAnswers): DuctalRecommendation {
  const acuteInflammatory = history.onset === "sudden" && history.pain === "yes" && (history.rednessWarmth === "yes" || history.fever === "yes");
  const suppurative = history.purulentDischarge === "yes" || history.acuteSuppurativeConcern === "yes";
  if (acuteInflammatory || suppurative) {
    return {
      state: "defer",
      title: "Contrast Sialography: Not Appropriate at This Stage — Clinical Assessment Required",
      explanation: "Acute painful glandular inflammation requires evaluation before retrograde contrast sialography. Defer the procedure when acute suppurative infection is suspected or confirmed.",
      considerations: ["Previously acquired images may still be reviewed.", "Other indicated imaging, including non-sialographic CT, remains available.", "Reassess the ductal question after the acute episode resolves."],
    };
  }
  if (history.impactedDistalStone === "yes") {
    return {
      state: "precaution", title: "Ductal mapping requires an impacted-stone precaution",
      explanation: "Pressurized retrograde contrast injection may displace an impacted distal calculus. A visible stone does not automatically justify sialography.",
      considerations: ["Define the management question first.", "Consider noncontrast CT/CBCT or sialendoscopy when appropriate.", "Apply local specialist protocol."],
    };
  }
  if (history.iodinatedContrastReaction === "yes" || history.priorSialographyReaction === "yes") {
    return {
      state: "precaution", title: "Contrast history requires clinician review",
      explanation: "Clarify the actual agent, reaction, severity, and procedural context before any contrast-based examination.",
      considerations: ["Do not use the imprecise label ‘iodine allergy’ as a diagnosis.", "Consider noncontrast or non-ionizing alternatives."],
    };
  }
  if (caseId === "case-03") {
    return {
      state: "precaution", title: "Selective ductal assessment only",
      explanation: "Sialography is not obligatory after minimally abnormal ultrasound. Consider it only for a specific unresolved ductal question when safe and likely to influence management.",
      considerations: ["Assess both parotid glands and both submandibular glands when a complete ultrasound survey is indicated.", "Clinical and laboratory criteria remain central."],
    };
  }
  if (caseId === "case-05" && history.palpableMass === "yes") {
    return {
      state: "precaution", title: "Ductal study suggests mass effect — characterize the lesion",
      explanation: "Sialography may demonstrate displacement or regional underfilling but cannot determine lesion histology. Targeted ultrasound and MRI are the priority recommendations.",
      considerations: ["Targeted right submandibular ultrasound with Color/Power Doppler.", "MRI with and without contrast when clinically appropriate.", "Tissue sampling is determined by the treating team."],
    };
  }
  return {
    state: "appropriate", title: "Dedicated ductal mapping may be considered",
    explanation: "Current fixture answers reveal no configured procedural contraindication. Proceed only when the result would influence management or procedural planning.",
    considerations: ["2D sialography", "CBCT sialography", "Sialendoscopy or another appropriate ductal assessment"],
  };
}

export function historyCompleteness(history: HistoryAnswers) {
  const core: (keyof HistoryAnswers)[] = ["age", "sex", "gland", "laterality", "symptomDuration", "onset", "pain", "mealPain", "mealSwelling", "recurrentSwelling", "swellingPattern", "xerostomia", "xerophthalmia", "thickMucous", "purulentDischarge", "fever", "rednessWarmth", "suddenSwelling", "palpableMass", "dysphagia", "trismus", "facialWeakness", "priorStones", "priorProcedure", "autoimmuneDisease", "familyAutoimmune", "childhoodParotitis", "radiotherapy", "radioiodine", "thyroidDisorder"];
  const completed = core.filter((key) => history[key] !== "" && history[key] !== "unknown").length;
  return { completed, total: core.length, percent: Math.round((completed / core.length) * 100) };
}

export function compatibleForFusion(exams: GlandExam[], modalities: ClinicalModality[]) {
  if (modalities.length < 2 || exams.length === 0) return false;
  return exams.some((exam) => modalities.every((modality) => exam.reviewed[modality]));
}

export function examIdentity(exam: Pick<GlandExam, "gland" | "side">) {
  return `${exam.side}|${exam.gland}`;
}
