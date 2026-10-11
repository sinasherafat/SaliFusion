import { deriveSafetyNotices } from "@/lib/clinical/recommendation-engine";
import type { AnalysisResult, AnalyzedStudy, IntegratedReport, PatientInfo, ReviewDecision } from "@/types/salifusion";

export class ReportService {
  create(patient: PatientInfo, studies: AnalyzedStudy[], result: AnalysisResult): IntegratedReport {
    return {
      patient,
      clinicalInformation: [patient.symptomCourse, ...patient.symptoms, ...patient.history, patient.medications && `Medications: ${patient.medications}`, patient.serology && `Serology: ${patient.serology}`, patient.clinicalNotes].filter(Boolean),
      studies,
      result: { ...result, safetyNotices: [...new Set([...result.safetyNotices, ...deriveSafetyNotices(patient)])] },
      reviewDecision: "Pending",
      clinicianNote: "",
      generatedAt: new Date().toISOString(),
    };
  }

  review(report: IntegratedReport, decision: ReviewDecision, clinicianNote = ""): IntegratedReport {
    return { ...report, reviewDecision: decision, clinicianNote };
  }
}
