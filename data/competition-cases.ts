import { DIAGNOSTIC_SUPPORT_SCORES } from "@/data/diagnostic-scores";
import type { CompetitionCase, HistoryAnswers, ModalityFixture } from "@/types/competition";

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
  observedFindings: [],
  interpretation: "No CBCT interpretation is available until a compatible study is reviewed.",
  differentials: [],
  limitations: [reason],
  recommendations: ["Import a genuine spatially valid DICOM series for MPR, or a screenshot for clearly labeled 2D image review."],
});

export const COMPETITION_CASES: CompetitionCase[] = [
  {
    id: "case-01", number: "01", shortTitle: "Obstructive disease",
    title: "Left Submandibular Sialolithiasis with Obstructive Ductal Disease",
    objective: "Detect a stone, map the duct, and assemble a management-focused multimodal interpretation.", accent: "#177f78",
    history: { ...unknownHistory, age: "42", sex: "male", gland: "submandibular", laterality: "left", symptomDuration: "9 months", onset: "recurrent", pain: "yes", mealPain: "yes", mealSwelling: "yes", recurrentSwelling: "yes", swellingPattern: "episodic", xerostomia: "yes", thickMucous: "yes", purulentDischarge: "no", fever: "no", rednessWarmth: "no", suddenSwelling: "no", priorStones: "yes", iodinatedContrastReaction: "no", priorSialographyReaction: "no", acuteSuppurativeConcern: "no", impactedDistalStone: "unknown", pregnancyStatus: "not-applicable", clinicianNotes: "Educational fixture. No acute suppurative signs are configured." },
    clinicalSummary: "Recurrent left submandibular meal-related pain and swelling with thick mucous discharge and no configured acute suppurative features. The history supports an obstructive question without establishing a definitive diagnosis.",
    ultrasound: {
      observedFindings: ["Left submandibular gland and duct assessed", "Ductal dilatation", "Hyperechoic intraductal focus", "Posterior acoustic shadowing", "Obstructive salivary change"],
      interpretation: "Findings are consistent with left submandibular ductal sialolithiasis with associated ductal dilatation and obstructive changes.",
      differentials: [{ label: "Ductal sialolithiasis", rationale: "Shadowing echogenic intraductal focus with upstream dilatation." }, { label: "Calcified ductal debris", rationale: "Can appear echogenic, though clean shadowing and obstruction favor calculus." }],
      limitations: ["Preset educational findings are pending verification against the final supplied video.", "Doppler is not configured for this case."],
      recommendations: ["Dedicated ductal mapping may be considered when the result would influence management or procedural planning.", "A visible stone does not automatically justify retrograde contrast sialography."],
    },
    sialography: {
      observedFindings: ["Main duct dilatation and focal stricture", "Additional distal or intraglandular narrowing", "Sialectasis with reduced peripheral arborization", "Pruned-tree-like configuration where supported", "Filling defect compatible with calculus when demonstrated", "Sialodochitis-type change"],
      interpretation: "Configured scenario supports obstructive ductal disease associated with left submandibular sialolithiasis and inflammatory ductal change.",
      differentials: [{ label: "Calculus-associated obstructive sialadenitis", rationale: "Ductal filling defect, dilatation, and inflammatory change are configured together." }, { label: "Primary ductal stenosis", rationale: "Narrowing may independently contribute to obstruction." }],
      limitations: ["Scenario reference findings remain pending image verification until corresponding phases are supplied.", "Radiopacity requires precontrast radiograph or CT/CBCT confirmation.", "Evacuation cannot be inferred without a documented timed phase."],
      recommendations: ["Use the least invasive study that answers a defined management question.", "Consider sialendoscopy for direct confirmation and possible treatment."],
    },
    cbct: unavailableCbct("No CBCT fixture is bundled. A screenshot is not a volumetric study."),
    fusion: {
      observedFindings: ["Ultrasound: shadowing intraductal focus and ductal dilatation", "2D sialography, when verified: strictures, sialectasis, and inflammatory ductal change", "CBCT, when imported as DICOM: spatial localization and MPR"],
      interpretation: "Integrated findings support left submandibular sialolithiasis with obstructive ductal dilatation and possible associated stricturing/sialodochitis relevant to sialendoscopic planning.",
      differentials: [{ label: "Obstructive sialolithiasis", rationale: "Concordant clinical and ultrasound fixture." }, { label: "Associated inflammatory ductal disease", rationale: "Ductal narrowing and sialectasis add complementary luminal information." }],
      limitations: ["Fusion is educational and only includes modalities explicitly reviewed for the same gland and side."],
      recommendations: ["Specialist assessment and procedural planning based on symptom burden, location, and verified imaging."],
    }, scores: DIAGNOSTIC_SUPPORT_SCORES["case-01"],
  },
  {
    id: "case-02", number: "02", shortTitle: "Acute inflammation",
    title: "Acute Unilateral Parotitis: Ultrasound and Doppler Assessment",
    objective: "Compare affected and normal glands, interpret Doppler, and demonstrate a responsible sialography safety stop.", accent: "#d05a4e",
    history: { ...unknownHistory, age: "26", sex: "female", gland: "parotid", laterality: "left", symptomDuration: "4 days", onset: "sudden", pain: "yes", mealPain: "unknown", mealSwelling: "no", recurrentSwelling: "no", swellingPattern: "persistent", xerostomia: "no", xerophthalmia: "no", thickMucous: "no", purulentDischarge: "no", fever: "unknown", rednessWarmth: "yes", suddenSwelling: "yes", palpableMass: "no", facialWeakness: "no", priorStones: "no", priorProcedure: "no", autoimmuneDisease: "no", childhoodParotitis: "no", viralParotitis: "unknown", iodinatedContrastReaction: "no", priorSialographyReaction: "no", acuteSuppurativeConcern: "unknown", impactedDistalStone: "no", pregnancyStatus: "unknown", clinicianNotes: "Acute unilateral inflammatory presentation. Clinical assessment is required before retrograde contrast procedures." },
    clinicalSummary: "Four-day acute left parotid swelling with pain and erythema. No purulent discharge or sicca symptoms are reported. Active inflammatory or infectious disease requires clinical assessment before retrograde contrast sialography.",
    ultrasound: {
      observedFindings: ["Affected left parotid: multiple relatively uniform hypoechoic areas", "Affected left parotid: mild-to-moderate parenchymal heterogeneity", "Descriptive pomegranate-like appearance where supported", "Affected Doppler: increased intraglandular vascularity", "Right parotid comparison: relatively homogeneous without comparable hypervascularity"],
      interpretation: "The configured B-mode and Doppler comparison supports acute inflammatory left parotid involvement. The descriptive pattern is not pathognomonic.",
      differentials: [{ label: "Acute parotitis / acute sialadenitis", rationale: "Acute painful unilateral erythematous presentation with configured hypervascularity." }, { label: "Autoimmune-related disease including Sjögren-related change", rationale: "Overlapping hypoechoic change is possible.", opposingEvidence: "Absence of sicca symptoms and relatively normal contralateral fixture make it less favored here." }, { label: "Other inflammatory or infectious cause", rationale: "Ultrasound does not identify a specific organism." }],
      limitations: ["All four video fixtures await user-supplied media and review.", "Doppler findings must only be applied to the Doppler clips."],
      recommendations: ["Clinical assessment for acute parotitis and complications.", "Use ultrasound to evaluate for a collection; consider other cross-sectional imaging if deep extension is suspected."],
    },
    sialography: {
      observedFindings: [], interpretation: "Contrast Sialography: Not Appropriate at This Stage — Clinical Assessment Required",
      differentials: [], limitations: ["No contrast sialography is configured for the active acute presentation."],
      recommendations: ["Defer retrograde contrast sialography when acute suppurative infection is suspected or confirmed.", "Previously acquired images may still be reviewed; this safety stop does not disable all CT imaging."],
    },
    cbct: unavailableCbct("Contrast CBCT sialography is deferred in this demo state; non-sialographic CT may still be clinically indicated for another question."),
    fusion: {
      observedFindings: ["Affected left parotid B-mode abnormalities", "Configured increased left intraglandular Doppler vascularity", "Relatively normal right parotid comparison"],
      interpretation: "Clinical and comparative ultrasound findings favor acute unilateral parotitis/sialadenitis; a contrast-sialography safety stop remains active pending clinical assessment.",
      differentials: [{ label: "Acute parotitis / acute sialadenitis", rationale: "Acute clinical course and hypervascular inflammatory fixture." }, { label: "Autoimmune-related disease", rationale: "Possible imaging overlap but less favored by this clinical pattern." }],
      limitations: ["Educational fixture; no microbiology, laboratory markers, or final supplied videos are available."], recommendations: ["Urgent clinical review if systemic illness, abscess, airway concern, or rapid progression develops."],
    }, scores: DIAGNOSTIC_SUPPORT_SCORES["case-02"],
  },
  {
    id: "case-03", number: "03", shortTitle: "Early autoimmune pattern",
    title: "Suspected Early Sjögren-Related Salivary Gland Involvement",
    objective: "Correlate subtle glandular and ductal findings without overcalling a systemic diagnosis.", accent: "#5573a5",
    history: { ...unknownHistory, age: "47", sex: "female", gland: "parotid", laterality: "bilateral", symptomDuration: "18 months", onset: "recurrent", pain: "no", mealPain: "no", mealSwelling: "unknown", recurrentSwelling: "yes", swellingPattern: "episodic", xerostomia: "yes", xerophthalmia: "yes", thickMucous: "unknown", purulentDischarge: "no", fever: "no", rednessWarmth: "no", suddenSwelling: "no", palpableMass: "no", facialWeakness: "no", priorStones: "no", priorProcedure: "no", autoimmuneDisease: "unknown", familyAutoimmune: "yes", childhoodParotitis: "no", viralParotitis: "no", radiotherapy: "no", radioiodine: "no", thyroidDisorder: "yes", antihypertensiveUse: "no", xerogenicMedications: "unknown", iodinatedContrastReaction: "no", priorSialographyReaction: "no", acuteSuppurativeConcern: "no", impactedDistalStone: "no", pregnancyStatus: "not-pregnant", clinicianNotes: "Nonacute sicca presentation with episodic bilateral swelling. Serologic and established diagnostic criteria are required." },
    clinicalSummary: "Nonacute sicca symptoms and episodic bilateral glandular swelling increase suspicion for autoimmune salivary disease. Imaging can support the clinical assessment but cannot establish Sjögren syndrome alone.",
    ultrasound: {
      observedFindings: ["Left parotid assessed", "Relatively preserved parenchymal architecture", "Mild heterogeneity", "A few small hypoechoic areas", "Subtle nonspecific change"],
      interpretation: "Mild chronic or early inflammatory glandular change is possible, including Sjögren-related involvement in the appropriate clinical context.",
      differentials: [{ label: "Early Sjögren-related involvement", rationale: "Sicca symptoms and episodic bilateral swelling increase clinical suspicion." }, { label: "Other nonspecific chronic inflammatory change", rationale: "Mild heterogeneity and small hypoechoic areas are not specific." }],
      limitations: ["The left parotid video awaits upload and verification.", "A complete assessment should consider both parotid and both submandibular glands — four glands total."],
      recommendations: ["Complete bilateral ultrasound assessment when clinically indicated.", "Clinical rheumatologic assessment, relevant serology, and established diagnostic criteria."],
    },
    sialography: {
      observedFindings: ["Fine punctate sialectasis", "Early peripheral ductal abnormalities", "Relatively preserved major ductal configuration where demonstrated"],
      interpretation: "Punctate sialectasis — compatible with an early Sjögren-related ductal pattern in the appropriate clinical context.",
      differentials: [{ label: "Sjögren-related ductal involvement", rationale: "Punctate sialectasis can support the diagnosis in the correct context." }, { label: "Other chronic inflammatory causes", rationale: "The finding is not exclusive to Sjögren syndrome, including recurrent inflammatory parotitis patterns." }],
      limitations: ["The acinar/parenchymal phase is the key intended image and awaits upload.", "The pattern is supportive rather than diagnostic."],
      recommendations: ["Use selective ductal assessment only for a specific unresolved question when safe and likely to influence management."],
    },
    cbct: unavailableCbct("No CBCT study is part of this preset scenario."),
    fusion: {
      observedFindings: ["History: xerostomia, xerophthalmia, and episodic bilateral swelling", "Ultrasound fixture: mild heterogeneity with a few small hypoechoic areas", "Sialography fixture when verified: punctate sialectasis"],
      interpretation: "The combined clinical, glandular, and ductal pattern is supportive of possible early Sjögren-related involvement but is not independently confirmatory.",
      differentials: [{ label: "Sjögren-related involvement", rationale: "Sicca symptoms and complementary subtle imaging findings." }, { label: "Other chronic inflammatory sialadenitis", rationale: "Neither mild heterogeneity nor punctate sialectasis is exclusive." }],
      limitations: ["Requires clinical examination, serology, established criteria, and sometimes additional tests."],
      recommendations: ["Rheumatologic assessment as appropriate and complete four-gland ultrasound when indicated."],
    }, scores: DIAGNOSTIC_SUPPORT_SCORES["case-03"],
  },
];

export function getCompetitionCase(id: string) {
  return COMPETITION_CASES.find((item) => item.id === id);
}

export const CORE_HISTORY_QUESTION_COUNT = 30;
