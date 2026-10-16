import { DIAGNOSTIC_SUPPORT_SCORES } from "@/data/diagnostic-scores";
import type { CompetitionCase, HistoryAnswers, ModalityFixture, SialographyPhase, SialographyPhaseFixture } from "@/types/competition";

const unknownHistory: HistoryAnswers = {
  age: "", sex: "unknown", gland: "parotid", laterality: "left", symptomDuration: "", onset: "unknown",
  pain: "unknown", mealPain: "unknown", mealSwelling: "unknown", recurrentSwelling: "unknown", swellingPattern: "unknown",
  xerostomia: "unknown", xerophthalmia: "unknown", thickMucous: "unknown", purulentDischarge: "unknown", fever: "unknown",
  rednessWarmth: "unknown", suddenSwelling: "unknown", palpableMass: "unknown", dysphagia: "unknown", trismus: "unknown",
  facialWeakness: "unknown", priorStones: "unknown", priorProcedure: "unknown", autoimmuneDisease: "unknown", familyAutoimmune: "unknown",
  childhoodParotitis: "unknown", viralParotitis: "unknown", radiotherapy: "unknown", radioiodine: "unknown", thyroidDisorder: "unknown",
  antihypertensiveUse: "unknown", xerogenicMedications: "unknown", iodinatedContrastReaction: "unknown", contrastReactionDetails: "",
  priorSialographyReaction: "unknown", acuteSuppurativeConcern: "unknown", impactedDistalStone: "unknown", pregnancyStatus: "unknown",
  proceduralPrecautions: "", clinicianNotes: "",
};

const unavailableCbct = (reason: string): ModalityFixture => ({
  observedFindings: [], interpretation: "No CBCT interpretation is available until a compatible study is reviewed.", differentials: [],
  limitations: [reason], recommendations: ["Import a genuine spatially valid DICOM series for MPR, or a screenshot for clearly labeled 2D image review."],
});

const phase = (phaseId: SialographyPhase, label: string, findings: string[], interpretation: string, options: Partial<Pick<SialographyPhaseFixture, "availability" | "timing" | "limitations">> = {}): SialographyPhaseFixture => ({
  phase: phaseId, label, availability: options.availability ?? "awaiting-image", findings, interpretation, timing: options.timing,
  limitations: options.limitations ?? ["Educational scenario findings require verification against the corresponding supplied phase image."],
});
const phases = (items: SialographyPhaseFixture[]) => Object.fromEntries(items.map((item) => [item.phase, item])) as Record<SialographyPhase, SialographyPhaseFixture>;

export const COMPETITION_CASES: CompetitionCase[] = [
  {
    id: "case-01", number: "01", shortTitle: "Complex obstruction", badge: "OB",
    title: "Radiopaque Sialolithiasis with Complex Obstructive Ductal Disease",
    objective: "Identify a radiopaque calculus, map main and peripheral duct disease, and document delayed drainage.", accent: "#177f78",
    history: { ...unknownHistory, age: "42", sex: "male", gland: "submandibular", laterality: "left", symptomDuration: "9 months", onset: "recurrent", pain: "yes", mealPain: "yes", mealSwelling: "yes", recurrentSwelling: "yes", swellingPattern: "episodic", xerostomia: "yes", thickMucous: "yes", purulentDischarge: "no", fever: "no", rednessWarmth: "no", suddenSwelling: "no", priorStones: "yes", iodinatedContrastReaction: "no", priorSialographyReaction: "no", acuteSuppurativeConcern: "no", impactedDistalStone: "unknown", pregnancyStatus: "not-applicable", clinicianNotes: "Educational fixture. No active suppurative features are configured." },
    clinicalSummary: "Recurrent left submandibular meal-related pain and swelling with thick mucous discharge and no configured active suppurative infection. The history supports an obstructive question without establishing a definitive diagnosis.",
    ultrasound: {
      observedFindings: ["Hyperechoic intraductal calculus", "Posterior acoustic shadowing", "Ductal dilatation", "Obstructive sialolithiasis pattern"],
      interpretation: "Educational observations support left submandibular obstructive sialolithiasis, pending verification against the final supplied video.",
      differentials: [{ label: "Ductal sialolithiasis", rationale: "A shadowing echogenic intraductal focus with upstream dilatation supports a calculus." }, { label: "Calcified ductal debris", rationale: "Calcified debris may appear echogenic, although clean shadowing and obstruction favor calculus." }],
      limitations: ["The ultrasound video slot is awaiting user-supplied media and clinician review."],
      recommendations: ["Assess stone location and accessibility for specialist or sialendoscopic planning.", "A visible stone does not automatically justify retrograde contrast sialography."],
    },
    sialography: {
      observedFindings: ["Radiopaque calculus on scout", "Main duct dilatation", "Multifocal main duct strictures", "Alternating stenosis and dilatation", "Peripheral sialectasis", "Reduced tertiary arborization", "Pruned-tree appearance", "Incomplete contrast evacuation"],
      interpretation: "Radiopaque left submandibular sialolithiasis with complex chronic obstructive ductal disease, including main duct dilatation, multifocal strictures, peripheral sialectasis, reduced arborization, and changes compatible with chronic sialodochitis. Incomplete evacuation suggests impaired ductal drainage.",
      differentials: [{ label: "Calculus-associated chronic obstructive sialadenitis", rationale: "Scout opacity, obstructive ductal change, and delayed clearance are configured together." }, { label: "Coexisting non-calculous ductal stenosis", rationale: "Separate multifocal strictures may independently contribute to obstruction." }],
      limitations: ["All phase observations are educational references awaiting image verification.", "No stone measurement or exact evacuation interval is supplied."],
      recommendations: ["Consider specialist assessment and sialendoscopic planning.", "Evaluate whether additional ductal mapping would change treatment.", "Use caution with retrograde injection if an impacted distal calculus is suspected."],
    },
    sialographyPhases: phases([
      phase("precontrast", "Scout / precontrast", ["Radiopaque calculus is present in the configured educational scenario"], "A radiopaque calculus is demonstrated; number, precise location, and dimensions require image verification.", { limitations: ["Do not infer the calculus number, exact location, or measurement until the scout image is supplied."] }),
      phase("ductal", "Ductal filling", ["Main duct dilatation", "Main duct irregularity", "Multifocal strictures", "Alternating stenosis and dilatation", "Sausage-link-like appearance", "Changes compatible with chronic sialodochitis"], "Complex main-duct obstructive and inflammatory change is configured; stenosis and dilatation are recorded as separate observations."),
      phase("acinar", "Acinar / parenchymal filling", ["Peripheral sialectasis", "Irregular small-duct filling", "Reduced tertiary ductal arborization", "Pruned-tree appearance"], "Peripheral ductal involvement is configured. Incomplete filling alone must not be used to diagnose glandular atrophy."),
      phase("evacuation", "Evacuation", ["Incomplete contrast evacuation", "Persistent contrast retention", "Delayed ductal clearance"], "Incomplete evacuation supports impaired ductal drainage without quantifying salivary secretory function.", { limitations: ["No exact post-stimulation or post-injection interval is available."] }),
    ]),
    cbct: unavailableCbct("No CBCT fixture is bundled. A screenshot is not a volumetric study."),
    fusion: {
      observedFindings: ["Ultrasound: shadowing intraductal focus and ductal dilatation", "Sialography: radiopaque calculus, strictures, sialectasis, reduced arborization, and delayed clearance", "CBCT, when imported as DICOM: spatial localization and genuine MPR"],
      interpretation: "Verified multimodal findings may support left submandibular sialolithiasis with complex chronic obstructive ductal disease relevant to procedural planning.",
      differentials: [{ label: "Calculus-associated obstructive disease", rationale: "Clinical, sonographic, and ductal features are potentially concordant." }, { label: "Associated inflammatory ductal disease", rationale: "Strictures and peripheral abnormalities add complementary luminal information." }],
      limitations: ["Fusion includes only reviewed, identity-matched modalities and remains educational."], recommendations: ["Specialist assessment and procedural planning based on verified imaging, symptom burden, and calculus accessibility."],
    }, scores: DIAGNOSTIC_SUPPORT_SCORES["case-01"],
  },
  {
    id: "case-02", number: "02", shortTitle: "Acute inflammation", badge: "AC",
    title: "Acute Unilateral Parotitis with Doppler Hypervascularity",
    objective: "Compare affected and normal glands, interpret Doppler, and demonstrate a history-responsive safety stop.", accent: "#d05a4e",
    history: { ...unknownHistory, age: "26", sex: "female", gland: "parotid", laterality: "left", symptomDuration: "4 days", onset: "sudden", pain: "yes", mealSwelling: "no", recurrentSwelling: "no", swellingPattern: "persistent", xerostomia: "no", xerophthalmia: "no", thickMucous: "no", purulentDischarge: "no", rednessWarmth: "yes", suddenSwelling: "yes", palpableMass: "no", facialWeakness: "no", priorStones: "no", priorProcedure: "no", autoimmuneDisease: "no", childhoodParotitis: "no", iodinatedContrastReaction: "no", priorSialographyReaction: "no", acuteSuppurativeConcern: "unknown", impactedDistalStone: "no", pregnancyStatus: "unknown", clinicianNotes: "Acute unilateral inflammatory presentation. Edit the acute findings to see the procedural recommendation update." },
    clinicalSummary: "Four-day acute left parotid swelling with pain and erythema. No purulent discharge or sicca symptoms are reported. The active inflammatory pattern triggers clinical assessment before retrograde contrast sialography.",
    ultrasound: {
      observedFindings: ["Affected left parotid: multiple relatively uniform hypoechoic areas", "Mild-to-moderate heterogeneity", "Descriptive pomegranate-like pattern where visible", "Affected left parotid Doppler hypervascularity", "Right parotid: no comparable hypervascularity"],
      interpretation: "The configured B-mode and Doppler comparison favors acute unilateral parotitis / sialadenitis. The descriptive pomegranate-like appearance is not pathognomonic.",
      differentials: [{ label: "Acute parotitis / acute sialadenitis", rationale: "Sudden painful unilateral erythematous swelling and affected-gland hypervascularity are concordant." }, { label: "Autoimmune-related glandular disease", rationale: "Hypoechoic changes may overlap.", opposingEvidence: "The sudden unilateral course, absent sicca symptoms, and normal comparison gland make it less favored." }, { label: "Other inflammatory or infectious cause", rationale: "Ultrasound does not establish a specific organism." }],
      limitations: ["All four comparison video slots await user-supplied media and review."], recommendations: ["Clinical assessment for acute parotitis and complications.", "Use ultrasound to assess for a collection and other imaging when deep extension is suspected."],
    },
    sialography: { observedFindings: [], interpretation: "Contrast Sialography: Defer During Suspected Active Acute Infection", differentials: [], limitations: ["No contrast sialography was performed in this scenario."], recommendations: ["Defer routine retrograde contrast sialography pending clinical assessment during suspected active infection.", "Previously acquired images and clinically indicated noncontrast CT remain reviewable."] },
    sialographyPhases: phases(([ ["precontrast", "Scout / precontrast"], ["ductal", "Ductal filling"], ["acinar", "Acinar / parenchymal filling"], ["evacuation", "Evacuation"] ] as [SialographyPhase, string][]).map(([id, label]) => phase(id, label, [], "No contrast sialography was performed for the configured acute presentation.", { availability: "not-provided", limitations: ["Previously acquired images may still be imported for review; new routine retrograde contrast imaging should follow clinical assessment."] }))),
    cbct: unavailableCbct("Contrast CBCT sialography is deferred in the active inflammatory state; non-sialographic CT may still be clinically indicated."),
    fusion: {
      observedFindings: ["Affected left parotid B-mode abnormalities", "Increased affected-gland Doppler vascularity", "Relatively normal right parotid comparison"],
      interpretation: "Clinical and comparative ultrasound findings favor acute unilateral parotitis / sialadenitis. Sialography was not performed, so ultrasound–sialography fusion is not available.",
      differentials: [{ label: "Acute parotitis / acute sialadenitis", rationale: "The acute course and hypervascular inflammatory pattern are concordant." }, { label: "Other inflammatory or infectious disease", rationale: "Imaging cannot determine the organism or full etiology." }],
      limitations: ["No sialography was performed; no cross-modal ductal fusion may be fabricated."], recommendations: ["Clinical review and treatment according to the suspected acute inflammatory or infectious process."],
    }, scores: DIAGNOSTIC_SUPPORT_SCORES["case-02"],
  },
  {
    id: "case-03", number: "03", shortTitle: "Early Sjögren pattern", badge: "SJ",
    title: "Suspected Early Sjögren Syndrome",
    objective: "Show that preserved main-duct and sonographic appearances do not exclude peripheral ductal abnormality.", accent: "#5573a5",
    history: { ...unknownHistory, age: "47", sex: "female", gland: "parotid", laterality: "bilateral", symptomDuration: "18 months", onset: "recurrent", pain: "no", mealPain: "no", recurrentSwelling: "yes", swellingPattern: "episodic", xerostomia: "yes", xerophthalmia: "yes", purulentDischarge: "no", fever: "no", rednessWarmth: "no", suddenSwelling: "no", palpableMass: "no", facialWeakness: "no", priorStones: "no", priorProcedure: "no", autoimmuneDisease: "unknown", familyAutoimmune: "yes", childhoodParotitis: "no", viralParotitis: "no", radiotherapy: "no", radioiodine: "no", thyroidDisorder: "yes", antihypertensiveUse: "no", iodinatedContrastReaction: "no", priorSialographyReaction: "no", acuteSuppurativeConcern: "no", impactedDistalStone: "no", pregnancyStatus: "not-pregnant", clinicianNotes: "Nonacute sicca presentation with intermittent bilateral swelling. Serology and established diagnostic criteria remain required." },
    clinicalSummary: "Chronic sicca symptoms and intermittent bilateral glandular swelling raise suspicion for Sjögren-related involvement. Imaging can support assessment but cannot establish the systemic diagnosis alone.",
    ultrasound: {
      observedFindings: ["No definite sonographic parenchymal abnormality is demonstrated"],
      interpretation: "No definite sonographic parenchymal abnormality is demonstrated. Early Sjögren-related involvement cannot be excluded on the basis of this examination.",
      differentials: [{ label: "Early Sjögren-related involvement", rationale: "The history remains clinically suspicious despite a nondiagnostic ultrasound." }, { label: "Other causes of sicca symptoms", rationale: "Medication, systemic, and non-autoimmune causes require clinical evaluation." }],
      limitations: ["The left parotid video awaits upload and verification.", "A complete ultrasound survey should consider both parotid and both submandibular glands."], recommendations: ["Clinical and rheumatologic assessment with relevant serology and established diagnostic criteria.", "Consider a complete four-gland ultrasound survey when indicated."],
    },
    sialography: {
      observedFindings: ["Preserved Main Duct Morphology", "Normal Stensen's duct caliber and configuration", "Finding A: Normal Main Duct Architecture", "Finding B: Peripheral Punctate Sialectasis", "Multiple fine peripheral punctate sialectases", "Incomplete evacuation with persistent residual contrast"],
      interpretation: "Peripheral punctate sialectasis with preserved main duct morphology may support early Sjögren-related ductal involvement in the appropriate clinical context. The combination is not pathognomonic.",
      differentials: [{ label: "Early Sjögren-related ductal involvement", rationale: "Peripheral punctate sialectasis can support the clinical suspicion." }, { label: "Other chronic inflammatory sialadenitis", rationale: "The finding is not specific to Sjögren syndrome." }],
      limitations: ["All phase observations await verification against supplied images.", "Imaging alone cannot confirm Sjögren syndrome or remove the need for established clinical criteria."], recommendations: ["Clinical and rheumatologic assessment with relevant serology.", "Additional contrast sialography should be selective rather than routine."],
    },
    sialographyPhases: phases([
      phase("precontrast", "Scout / precontrast", [], "No calculus or other scout finding is asserted without a supplied image.", { limitations: ["Scout findings are unsupported until an image is supplied."] }),
      phase("ductal", "Ductal filling", ["Preserved Main Duct Morphology", "Normal Stensen's duct caliber", "Normal duct configuration and regular contour", "No significant stenosis or main-duct dilatation", "No filling defect"], "Finding A: Normal Main Duct Architecture."),
      phase("acinar", "Acinar / parenchymal filling", ["Finding B: Peripheral Punctate Sialectasis", "Multiple fine, relatively uniform punctate sialectases", "Peripheral / acinar distribution", "Relatively preserved main duct architecture"], "A normal main duct does not exclude peripheral ductal abnormalities."),
      phase("evacuation", "Evacuation", ["Incomplete contrast evacuation", "Persistent residual contrast", "Delayed clearance"], "Delayed clearance is described qualitatively and is not a quantitative measurement of salivary secretory function."),
    ]),
    cbct: unavailableCbct("No CBCT study is part of this preset scenario."),
    fusion: {
      observedFindings: ["History: xerostomia, xerophthalmia, and intermittent bilateral swelling", "Ultrasound: no definite parenchymal abnormality", "Sialography: preserved main duct with peripheral punctate sialectasis"],
      interpretation: "The clinical history and peripheral ductal pattern may support early Sjögren-related involvement despite no definite ultrasound abnormality, but the combination is not pathognomonic.",
      differentials: [{ label: "Early Sjögren-related involvement", rationale: "Sicca symptoms and peripheral punctate change are complementary." }, { label: "Other chronic inflammatory sialadenitis", rationale: "Punctate sialectasis is not exclusive." }],
      limitations: ["Requires clinical examination, serology, established criteria, and sometimes additional testing."], recommendations: ["Rheumatologic assessment and complete four-gland ultrasound when clinically indicated."],
    }, scores: DIAGNOSTIC_SUPPORT_SCORES["case-03"],
  },
  {
    id: "case-04", number: "04", shortTitle: "Occult obstruction", badge: "OD",
    title: "Occult Ductal Obstruction with Noncalcified Filling Defect",
    objective: "Demonstrate a sialography-first pathway when a negative scout does not resolve obstructive symptoms.", accent: "#9a6a28",
    history: { ...unknownHistory, gland: "submandibular", laterality: "left", symptomDuration: "recurrent", onset: "recurrent", pain: "yes", mealPain: "yes", mealSwelling: "yes", recurrentSwelling: "yes", swellingPattern: "episodic", purulentDischarge: "no", acuteSuppurativeConcern: "no", clinicianNotes: "Left side is a configurable provisional demo laterality because the source summary did not establish a patient-specific side. Unsupported responses remain Unknown." },
    clinicalSummary: "Recurrent meal-related painful submandibular swelling suggests obstruction. Left laterality is a configurable demonstration assumption, not a confirmed patient-specific fact.",
    ultrasound: { observedFindings: [], interpretation: "No ultrasound has been performed in the configured sialography-first pathway.", differentials: [], limitations: ["Ultrasound is optional and no media are supplied."], recommendations: ["Targeted ultrasound may assess inflammation, ductal dilatation, obstructive material, and associated parenchymal abnormality."] },
    sialography: {
      observedFindings: ["No radiopaque sialolith on scout", "Distal main duct filling defect", "Main duct dilatation", "Focal stenosis and ductal irregularity", "Secondary and tertiary duct involvement", "Alternating ectatic and stenotic segments", "Reduced peripheral arborization and pruned-tree appearance", "Incomplete evacuation at five minutes"],
      interpretation: "A distal main-duct filling defect despite no definite radiopaque calculus on scout is associated with complex chronic obstructive change and delayed clearance. Noncalcified calculus and mucous plug remain leading considerations.",
      differentials: [{ label: "Noncalcified calculus", rationale: "A filling defect can reflect a calculus not visible on scout." }, { label: "Mucous plug", rationale: "Intraductal mucous may create a similar noncalcified filling defect." }, { label: "Other intraductal material", rationale: "Direct classification requires verification or endoscopic assessment." }],
      limitations: ["Educational phase findings await image verification.", "The filling defect must not be definitively labeled a stone without supporting evidence."], recommendations: ["Consider targeted ultrasound, noncontrast CT/CBCT, or sialendoscopy according to the clinical question."],
    },
    sialographyPhases: phases([
      phase("precontrast", "Scout / precontrast", ["No radiopaque sialolith is identified"], "A negative scout does not exclude a noncalcified calculus, mucous plug, or other ductal obstruction."),
      phase("ductal", "Ductal filling", ["Distal main duct filling defect", "Main duct dilatation", "Focal stenosis", "Ductal irregularity", "Sialectasis", "Changes compatible with chronic sialodochitis"], "The filling defect is obstructive but cannot be definitively classified as a stone without supporting evidence."),
      phase("acinar", "Acinar / parenchymal filling", ["Persistent main-duct abnormalities", "Secondary and tertiary duct involvement", "Alternating ectatic and stenotic segments", "Sialectasis", "Reduced peripheral arborization", "Pruned-tree appearance"], "Main, secondary, and tertiary duct abnormalities indicate complex chronic inflammatory and obstructive change."),
      phase("evacuation", "Evacuation", ["Persistent contrast retention", "Incomplete contrast evacuation", "Delayed ductal clearance"], "Incomplete contrast evacuation at five minutes, consistent with delayed clearance and possible impaired ductal drainage.", { timing: "Five minutes", limitations: ["Clearance is not a measured salivary flow rate."] }),
    ]),
    cbct: unavailableCbct("No CBCT study is supplied; noncontrast CT/CBCT remains a possible further test according to clinical indications."),
    fusion: {
      observedFindings: ["Sialography independently maps an occult filling defect and multilevel ductal disease"],
      interpretation: "This is a valid single-modality sialography pathway. Fusion is not applicable unless a compatible second examination of the same gland and side is reviewed.",
      differentials: [{ label: "Noncalcified calculus", rationale: "Negative scout with a positive filling defect remains compatible." }, { label: "Mucous plug", rationale: "A noncalcified intraductal plug is an alternative." }],
      limitations: ["No ultrasound or CBCT study has been performed; no artificial second-modality finding is generated."], recommendations: ["Targeted ultrasound, noncontrast CT/CBCT, or sialendoscopy may be considered according to clinical need."],
    }, scores: DIAGNOSTIC_SUPPORT_SCORES["case-04"],
  },
  {
    id: "case-05", number: "05", shortTitle: "Space-occupying lesion", badge: "SL",
    title: "Right Submandibular Space-Occupying Lesion",
    objective: "Recognize regional underfilling and ductal displacement, then recommend tissue-characterizing imaging.", accent: "#765b8e",
    history: { ...unknownHistory, age: "42", sex: "male", gland: "submandibular", laterality: "right", symptomDuration: "approximately 2 years", onset: "gradual", pain: "no", mealPain: "no", recurrentSwelling: "no", swellingPattern: "persistent", xerostomia: "no", xerophthalmia: "no", purulentDischarge: "no", fever: "no", rednessWarmth: "no", suddenSwelling: "no", palpableMass: "yes", dysphagia: "no", trismus: "no", facialWeakness: "no", autoimmuneDisease: "no", antihypertensiveUse: "no", xerogenicMedications: "no", acuteSuppurativeConcern: "no", pregnancyStatus: "not-applicable", clinicianNotes: "Chronic painless, gradually enlarging, nontender rubbery right submandibular swelling. No saliva was expressed from the right Wharton's duct with massage; clear secretion was described on the left. No patient identifiers are included." },
    clinicalSummary: "A 42-year-old male educational fixture has a chronic painless, gradually enlarging right submandibular swelling of approximately two years. The summarized examination raises concern for a focal space-occupying process without assigning histology.",
    ultrasound: { observedFindings: [], interpretation: "No ultrasound findings are manufactured before the Case 5 study is supplied.", differentials: [], limitations: ["The dedicated right submandibular ultrasound slot is awaiting user-supplied media."], recommendations: ["Targeted Ultrasound of the Right Submandibular Gland with Color/Power Doppler", "Assess solid versus cystic composition, lesion boundaries and size, parenchymal involvement, vascularity, adjacent structures, regional nodes, and suitability for image-guided sampling."] },
    sialography: {
      observedFindings: ["Scout phase not provided", "Complete filling of primary and secondary ducts", "Mild distal Wharton's duct dilatation", "No definite filling defect", "Regional reduction in inferior glandular filling", "Ductal splaying and displacement", "No contrast extravasation", "Contrast clearance at three minutes without definite delay"],
      interpretation: "Regional reduction in right submandibular glandular filling with ductal splaying and displacement raises suspicion for an underlying space-occupying lesion. Mild distal Wharton's duct dilatation is present without a definite intraductal filling defect.",
      differentials: [{ label: "Focal salivary gland space-occupying lesion", rationale: "Regional underfilling and displaced, splayed ducts suggest mass effect." }, { label: "Chronic sclerosing sialadenitis / Küttner tumor", rationale: "A firm submandibular process can mimic neoplasia and requires characterization." }, { label: "IgG4-related sialadenitis", rationale: "Consider only when clinically appropriate." }, { label: "Benign or malignant salivary neoplasm", rationale: "Imaging and tissue assessment are required; sialography cannot determine histology." }],
      limitations: ["The source is a summarized educational reference; original images and report have not been independently verified.", "No scout phase was documented."], recommendations: ["Targeted Ultrasound of the Right Submandibular Gland with Color/Power Doppler", "MRI of the Neck and Right Submandibular Region, With and Without Intravenous Contrast When Clinically Appropriate", "Consider ultrasound-guided fine-needle aspiration or core needle biopsy when clinically appropriate."],
    },
    sialographyPhases: phases([
      phase("precontrast", "Scout / precontrast", [], "Not Provided", { availability: "not-provided", limitations: ["No scout phase is documented in the summarized reference; no scout finding is generated."] }),
      phase("ductal", "Ductal filling", ["Complete filling of primary and secondary ducts", "Mild distal Wharton's duct dilatation", "No definite filling defect", "No significant obstructive pattern"], "Primary and secondary ducts fill without a definite intraductal obstructive lesion."),
      phase("acinar", "Acinar / parenchymal filling", ["Incomplete glandular opacification", "Reduced acinar filling in the inferior right submandibular gland", "Regional mass effect", "Ductal displacement", "Ductal splaying", "No contrast extravasation"], "Regional underfilling with displaced and splayed ducts raises suspicion for an underlying space-occupying process without defining histology."),
      phase("evacuation", "Evacuation", ["Contrast clearance is observed", "No definite delayed evacuation in the documented examination"], "Contrast clearance is observed at three minutes, without definite delayed evacuation in the documented examination.", { timing: "Three minutes", limitations: ["Clearance does not establish that the entire gland is normal and is not a quantitative secretory measurement."] }),
    ]),
    cbct: unavailableCbct("No CBCT study is supplied. MRI is recommended for soft-tissue characterization rather than adding a new MRI module to this demo."),
    fusion: {
      observedFindings: ["Sialography: regional underfilling with ductal splaying and displacement", "Ultrasound: recommended but not yet supplied", "MRI: recommended for further characterization"],
      interpretation: "The sialographic pattern raises suspicion for a right submandibular space-occupying lesion. Fusion is not applicable until a compatible second study is reviewed, and histology must not be inferred.",
      differentials: [{ label: "Focal salivary gland lesion", rationale: "Regional mass effect is present in the summarized ductal study." }, { label: "Chronic sclerosing or IgG4-related sialadenitis", rationale: "Inflammatory pseudotumoral processes remain alternatives." }, { label: "Salivary neoplasm", rationale: "Benign and malignant lesions require imaging and tissue characterization." }],
      limitations: ["Original clinical images are not yet supplied or independently verified.", "No ultrasound finding is generated in advance."], recommendations: ["Targeted right submandibular ultrasound with Color/Power Doppler.", "MRI of the neck and right submandibular region with and without contrast when clinically appropriate.", "Treating clinicians determine whether fine-needle aspiration or core biopsy is appropriate."],
    }, scores: DIAGNOSTIC_SUPPORT_SCORES["case-05"],
  },
];

export function getCompetitionCase(id: string) { return COMPETITION_CASES.find((item) => item.id === id); }
export const CORE_HISTORY_QUESTION_COUNT = 30;
