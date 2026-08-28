import type { AnalysisResult, IntegratedReport, PatientInfo, ReviewDecision } from "@/types/salifusion";

export class ReportService {
  create(patient: PatientInfo, result: AnalysisResult): IntegratedReport {
    return {
      patient,
      clinicalInformation: patient.symptoms,
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
