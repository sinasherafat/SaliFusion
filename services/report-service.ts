import type { AnalysisResult, AnalyzedStudy, IntegratedReport, PatientInfo, ReviewDecision } from "@/types/salifusion";

export class ReportService {
  create(patient: PatientInfo, studies: AnalyzedStudy[], result: AnalysisResult): IntegratedReport {
    return {
      patient,
      clinicalInformation: [...patient.symptoms, ...(patient.clinicalNotes.trim() ? [patient.clinicalNotes.trim()] : [])],
      studies,
      result,
      reviewDecision: "Pending",
      clinicianNote: "",
      generatedAt: new Date().toISOString(),
    };
  }

  review(report: IntegratedReport, decision: ReviewDecision, clinicianNote = ""): IntegratedReport {
    return { ...report, reviewDecision: decision, clinicianNote };
  }
}
