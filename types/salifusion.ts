export type Modality = "ultrasound" | "sialography_2d" | "cbct_3d" | "mr_sialography";
export type ResultModality = Modality | "multimodal";
export type Confidence = "High" | "Moderate" | "Low";
export type Concordance = "High Concordance" | "Partial Concordance" | "Discordance Detected";
export type ReviewDecision = "Pending" | "Accepted" | "Modified" | "Rejected";

export interface PatientInfo {
  patientName: string;
  patientId: string;
  age: string;
  sex: "" | "Female" | "Male" | "Other" | "Not specified";
  gland: "" | "Parotid" | "Submandibular";
  side: "" | "Right" | "Left" | "Bilateral";
  symptoms: string[];
  clinicalNotes: string;
}

export interface AnalysisResult {
  caseId: string;
  modality: ResultModality;
  isCuratedDemoCase: boolean;
  imageQuality: "Adequate" | "Limited";
  findings: string[];
  assessment: string;
  differentials: string[];
  supportingFeatures: string[];
  complementaryFindings?: string[];
  conflictingFindings?: string[];
  confidence: Confidence;
  concordance: Concordance | null;
  additionalImagingRecommendation: string;
  recommendedNextModality?: Modality;
  demoOnly: true;
}

export interface DemoAsset {
  modality: Modality;
  src: string;
  alt: string;
}

export interface DemoCase {
  id: string;
  title: string;
  shortTitle: string;
  modality: Modality;
  message: string;
  assets: DemoAsset[];
  result: AnalysisResult;
  modalityResults?: Partial<Record<Modality, AnalysisResult>>;
  fusionResult?: AnalysisResult;
}

export interface AnalyzedStudy {
  caseId: string;
  modality: Modality;
  asset: DemoAsset;
  result: AnalysisResult;
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
