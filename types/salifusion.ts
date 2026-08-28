export type Modality = "ultrasound" | "sialography_2d" | "cbct_3d" | "multimodal";
export type Confidence = "High" | "Moderate" | "Low";
export type Concordance = "High Concordance" | "Partial Concordance" | "Discordance Detected";
export type ReviewDecision = "Pending" | "Accepted" | "Modified" | "Rejected";

export interface PatientInfo {
  patientId: string;
  age: string;
  sex: "" | "Female" | "Male" | "Other" | "Not specified";
  gland: "" | "Parotid" | "Submandibular";
  side: "" | "Right" | "Left" | "Bilateral";
  symptoms: string[];
}

export interface AnalysisResult {
  caseId: string;
  modality: Modality;
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
  recommendation?: string;
  demoOnly: true;
}

export interface DemoAsset {
  modality: Exclude<Modality, "multimodal">;
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
  result: AnalysisResult;
  reviewDecision: ReviewDecision;
  clinicianNote: string;
  generatedAt: string;
}
