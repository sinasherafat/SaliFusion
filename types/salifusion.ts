export type Modality = "ultrasound" | "sialography_2d" | "cbct_3d";
export type ResultModality = Modality | "multimodal";
export type Confidence = "High" | "Moderate" | "Low";
export type Concordance = "High Concordance" | "Partial Concordance" | "Discordance Detected";
export type ReviewDecision = "Pending" | "Accepted" | "Modified" | "Rejected";
export type SialographyPhase = "Precontrast" | "Ductal filling" | "Acinar / parenchymal filling" | "Evacuation";
export type RecommendationPriority = "Preferred" | "Optional" | "Currently inappropriate";
export type AssetKind = "clinical-reference" | "synthetic-schematic";

export interface PatientInfo {
  patientName: string;
  patientId: string;
  age: string;
  sex: "" | "Female" | "Male" | "Other" | "Not specified";
  gland: "" | "Parotid" | "Submandibular";
  side: "" | "Right" | "Left" | "Bilateral";
  symptomCourse: "" | "Acute" | "Chronic" | "Recurrent";
  symptoms: string[];
  history: string[];
  medications: string;
  serology: string;
  contrastReaction: "" | "None known" | "Previous mild reaction" | "Previous severe reaction" | "Unknown";
  clinicalNotes: string;
}

export interface ImagingRecommendation {
  modality: string;
  priority: RecommendationPriority;
  rationale: string;
  expectedContribution: string;
  safety: string;
  alternatives: string[];
}

export interface DuctMapItem {
  structure: string;
  location: string;
  finding: string;
  extent?: string;
}

export interface AnalysisResult {
  caseId: string;
  modality: ResultModality;
  isCuratedDemoCase: boolean;
  imageQuality: "Adequate" | "Limited";
  observedFindings: string[];
  patternInterpretations: string[];
  assessment: string;
  differentials: string[];
  supportingClinicalInformation: string[];
  missingEvidence: string[];
  limitations: string[];
  ductMap?: DuctMapItem[];
  phasesAvailable?: SialographyPhase[];
  complementaryFindings?: string[];
  conflictingFindings?: string[];
  confidence: Confidence;
  concordance: Concordance | null;
  recommendations: ImagingRecommendation[];
  safetyNotices: string[];
  demoOnly: true;
}

export interface DemoAsset {
  modality: Modality;
  src: string;
  alt: string;
  kind: AssetKind;
  sourceLabel: string;
  phase?: SialographyPhase;
}

export interface DemoCase {
  id: string;
  title: string;
  shortTitle: string;
  summary: string;
  initialModality: Modality;
  patient: PatientInfo;
  assets: DemoAsset[];
  modalityResults: Partial<Record<Modality, AnalysisResult>>;
  fusionResult?: AnalysisResult;
  competitionRole?: "high-impact" | "safety-stop";
}

export interface AnalyzedStudy {
  caseId: string;
  modality: Modality;
  asset: DemoAsset;
  result: AnalysisResult;
  patientKey: string;
}

export interface DicomMetadata {
  fileName: string;
  imageId?: string;
  patientId?: string;
  patientName?: string;
  studyDate?: string;
  studyInstanceUID?: string;
  seriesInstanceUID: string;
  seriesDescription?: string;
  modality?: string;
  instanceNumber?: number;
  imagePosition?: [number, number, number];
  imageOrientation?: [number, number, number, number, number, number];
  sliceLocation?: number;
  sliceThickness?: number;
  rows?: number;
  columns?: number;
  pixelSpacing?: [number, number];
  transferSyntax?: string;
  spatialPosition?: number;
  spatiallySorted: boolean;
}

export interface ParsedDicomFile {
  file: File;
  metadata: DicomMetadata;
}

export interface DicomSeries {
  uid: string;
  description: string;
  modality: string;
  instances: ParsedDicomFile[];
  spatiallySorted: boolean;
  warning?: string;
}

export interface IntegratedReport {
  patient: PatientInfo;
  clinicalInformation: string[];
  studies: AnalyzedStudy[];
  result: AnalysisResult;
  reviewDecision: ReviewDecision;
  clinicianNote: string;
  generatedAt: string;
}

export function patientStudyKey(patient: PatientInfo) {
  return [patient.patientId.trim().toLowerCase(), patient.gland, patient.side].join("|");
}
