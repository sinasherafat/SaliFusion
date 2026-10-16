import type { DicomSeries } from "@/types/salifusion";

export type CaseId = "case-01" | "case-02" | "case-03" | "case-04" | "case-05";
export type WorkflowStep = "history" | "imaging" | "reports" | "fusion" | "final";
export type ClinicalModality = "ultrasound" | "sialography" | "cbct";
export type TriState = "yes" | "no" | "unknown";
export type Gland = "parotid" | "submandibular" | "sublingual" | "other";
export type Side = "left" | "right";
export type UltrasoundMode = "bmode" | "color-doppler" | "power-doppler";
export type SialographyPhase = "precontrast" | "ductal" | "acinar" | "evacuation";

export interface HistoryAnswers {
  age: string;
  sex: "female" | "male" | "other" | "unknown";
  gland: Gland;
  laterality: Side | "bilateral";
  symptomDuration: string;
  onset: "sudden" | "gradual" | "recurrent" | "unknown";
  pain: TriState;
  mealPain: TriState;
  mealSwelling: TriState;
  recurrentSwelling: TriState;
  swellingPattern: "persistent" | "episodic" | "unknown";
  xerostomia: TriState;
  xerophthalmia: TriState;
  thickMucous: TriState;
  purulentDischarge: TriState;
  fever: TriState;
  rednessWarmth: TriState;
  suddenSwelling: TriState;
  palpableMass: TriState;
  dysphagia: TriState;
  trismus: TriState;
  facialWeakness: TriState;
  priorStones: TriState;
  priorProcedure: TriState;
  autoimmuneDisease: TriState;
  familyAutoimmune: TriState;
  childhoodParotitis: TriState;
  viralParotitis: TriState;
  radiotherapy: TriState;
  radioiodine: TriState;
  thyroidDisorder: TriState;
  antihypertensiveUse: TriState;
  xerogenicMedications: TriState;
  iodinatedContrastReaction: TriState;
  contrastReactionDetails: string;
  priorSialographyReaction: TriState;
  acuteSuppurativeConcern: TriState;
  impactedDistalStone: TriState;
  pregnancyStatus: "not-applicable" | "not-pregnant" | "pregnant" | "unknown";
  proceduralPrecautions: string;
  clinicianNotes: string;
}

export interface DemoMediaSlot {
  id: string;
  caseId: CaseId;
  modality: "ultrasound";
  gland: "parotid" | "submandibular";
  side: Side;
  mode: UltrasoundMode;
  label: string;
  mediaUrl?: string;
  status: "ready" | "awaiting-upload";
}

export interface Differential {
  label: string;
  rationale: string;
  opposingEvidence?: string;
}

export interface ModalityFixture {
  observedFindings: string[];
  interpretation: string;
  differentials: Differential[];
  limitations: string[];
  recommendations: string[];
}

export interface SialographyPhaseFixture {
  phase: SialographyPhase;
  label: string;
  availability: "awaiting-image" | "not-provided";
  findings: string[];
  interpretation: string;
  timing?: string;
  limitations: string[];
}

export interface ScoreFixture {
  label: string;
  score: number;
  rationale: string;
}

export interface CompetitionCase {
  id: CaseId;
  number: string;
  title: string;
  shortTitle: string;
  badge: string;
  objective: string;
  accent: string;
  history: HistoryAnswers;
  clinicalSummary: string;
  ultrasound: ModalityFixture;
  sialography: ModalityFixture;
  sialographyPhases: Record<SialographyPhase, SialographyPhaseFixture>;
  cbct: ModalityFixture;
  fusion: ModalityFixture;
  scores: ScoreFixture[];
}

export interface UploadedAsset {
  id: string;
  name: string;
  url: string;
  kind: "video" | "image";
  objectUrl: boolean;
}

export interface PhaseAsset {
  name: string;
  url: string;
  objectUrl: boolean;
}

export interface GlandExam {
  id: string;
  gland: Gland;
  side: Side;
  reviewed: Partial<Record<ClinicalModality, boolean>>;
  clinicianVerified: Partial<Record<ClinicalModality, boolean>>;
  ultrasoundUploads: Record<string, UploadedAsset | undefined>;
  phaseUploads: Partial<Record<SialographyPhase, PhaseAsset>>;
  cbctImages: PhaseAsset[];
  dicomSeries: DicomSeries[];
  selectedSeriesUid: string;
  dicomError: string;
}

export interface CaseSession {
  history: HistoryAnswers;
  step: WorkflowStep;
  exams: GlandExam[];
  activeExamId: string;
  activeModality: ClinicalModality;
  selectedMediaSlot: string;
  comparisonMode: boolean;
  fusionGenerated: boolean;
  clinicianObservations: Partial<Record<ClinicalModality, string>>;
}

export const WORKFLOW_STEPS: { id: WorkflowStep; number: string; label: string }[] = [
  { id: "history", number: "01", label: "History" },
  { id: "imaging", number: "02", label: "Imaging" },
  { id: "reports", number: "03", label: "Modality Reports" },
  { id: "fusion", number: "04", label: "Fusion" },
  { id: "final", number: "05", label: "Final Report" },
];
