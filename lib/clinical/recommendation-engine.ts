import type { AnalysisResult, ImagingRecommendation, PatientInfo } from "@/types/salifusion";

const has = (patient: PatientInfo, value: string) => patient.symptoms.includes(value) || patient.history.includes(value);

export function isAcuteSuppurativeRisk(patient: PatientInfo) {
  return has(patient, "Fever / acute infection") && has(patient, "Purulent discharge");
}

export function deriveSafetyNotices(patient: PatientInfo): string[] {
  const notices: string[] = [];
  if (isAcuteSuppurativeRisk(patient)) notices.push("Routine retrograde contrast sialography is inappropriate during suspected acute suppurative infection. Obtain urgent clinician assessment and treat infection first.");
  if (patient.contrastReaction === "Previous severe reaction") notices.push("Previous severe contrast reaction requires specialist risk assessment before any contrast-based ductal examination.");
  if (patient.contrastReaction === "Previous mild reaction") notices.push("Previous mild contrast reaction is a relative precaution; confirm agent, reaction, and local protocol.");
  if (has(patient, "Facial nerve symptoms")) notices.push("Facial nerve symptoms with a salivary mass are a red flag requiring expedited specialist assessment.");
  return notices;
}

export function recommendImaging(patient: PatientInfo, result?: AnalysisResult | null): ImagingRecommendation[] {
  const safety = deriveSafetyNotices(patient);
  const observed = result?.observedFindings.join(" ").toLowerCase() ?? "";

  if (isAcuteSuppurativeRisk(patient)) {
    return [{ modality: "Contrast sialography", priority: "Currently inappropriate", rationale: "Fever and purulent ductal discharge support active suppurative infection.", expectedContribution: "Deferred until the acute infection has resolved and a ductal question remains.", safety: safety[0], alternatives: ["Urgent clinical assessment", "Ultrasound for abscess or collection", "Cross-sectional imaging if deep extension is suspected"] }];
  }
  if (has(patient, "Palpable mass") || observed.includes("mass") || observed.includes("displacement")) {
    return [{ modality: "Ultrasound with genuine Doppler ± MRI / tissue pathway", priority: "Preferred", rationale: "A focal mass or ductal displacement requires tissue characterization; sialography cannot establish histology.", expectedContribution: "Define solid versus cystic composition, vascular pattern when Doppler is present, deep-lobe extent, and biopsy target.", safety: "Escalate promptly when facial nerve dysfunction, fixation, or suspicious nodes are present.", alternatives: ["MRI", "Image-guided cytology or core biopsy", "Specialist head and neck assessment"] }];
  }
  if (has(patient, "Xerostomia") && has(patient, "Xerophthalmia")) {
    return [{ modality: "Clinical / laboratory assessment with salivary ultrasound", priority: "Preferred", rationale: "Combined ocular and oral dryness raises autoimmune disease; imaging is only one part of classification.", expectedContribution: "Assess glandular heterogeneity and complications while serology and clinical criteria address systemic disease.", safety: "Do not use a negative ultrasound to trigger routine contrast sialography automatically.", alternatives: ["Relevant serology", "Schirmer testing", "Minor salivary gland biopsy when clinically indicated"] }];
  }
  if (has(patient, "Thick mucous discharge") && has(patient, "Recurrent swelling")) {
    return [{ modality: "Dedicated ductal evaluation", priority: "Preferred", rationale: "Recurrent swelling with thick mucous discharge can reflect complex inflammatory or fibrinous ductal disease despite unrevealing ultrasound.", expectedContribution: "Characterize strictures, casts, filling defects, and branch-level ductal change.", safety: safety[0] ?? "Confirm that no acute suppurative infection is present before retrograde contrast injection.", alternatives: ["Sialendoscopy", "MR sialography", "Conventional or CBCT sialography when appropriate"] }];
  }
  if (has(patient, "Meal-related swelling or pain") || has(patient, "Recurrent swelling")) {
    const stoneSeen = observed.includes("calculus") || observed.includes("shadowing");
    return [{ modality: stoneSeen ? "Further imaging" : "Targeted ductal assessment", priority: stoneSeen ? "Optional" : "Preferred", rationale: stoneSeen ? "The current examination already localizes an obstructing calculus." : "Persistent obstructive symptoms remain unexplained by the available examination.", expectedContribution: stoneSeen ? "Additional imaging is unlikely to change the central demonstration finding." : "Identify occult calculus, stenosis, ductal dilatation, or evacuation abnormality.", safety: "Retrograde contrast injection may displace an obstructing stone; choose the test according to the precise clinical question.", alternatives: ["Noncontrast CT / CBCT", "Sialendoscopy", "Conventional sialography", "MR sialography"] }];
  }
  return [{ modality: "No automatic additional examination", priority: "Optional", rationale: "No unresolved high-value imaging question is evident from the entered history and current curated findings.", expectedContribution: "Further imaging should be selected only if it is expected to answer a defined clinical question.", safety: safety[0] ?? "Review contraindications and local protocol before any contrast examination.", alternatives: ["Clinical follow-up", "Specialist assessment if symptoms persist or evolve"] }];
}
