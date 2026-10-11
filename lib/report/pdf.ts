import type { IntegratedReport } from "@/types/salifusion";

const clean = (value: string) => value.normalize("NFKD").replace(/[^\x20-\x7E]/g, "-").replace(/[()\\]/g, "\\$&");
const wrap = (value: string, width = 88) => {
  const words = clean(value).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (`${line} ${word}`.trim().length > width) { if (line) lines.push(line); line = word; } else line = `${line} ${word}`.trim();
  }
  if (line) lines.push(line);
  return lines;
};

export function createReportPdf(report: IntegratedReport): Uint8Array {
  const { patient, result, studies } = report;
  const rows = [
    "SaliFusion Structured Imaging Report",
    "EDUCATIONAL DEMONSTRATION - NOT FOR CLINICAL DIAGNOSIS",
    "",
    `Patient: ${patient.patientName || "Not provided"}   ID: ${patient.patientId || "Not provided"}`,
    `Age/Sex: ${patient.age || "-"} / ${patient.sex || "-"}   Site: ${patient.side} ${patient.gland}`,
    `Clinical indication: ${report.clinicalInformation.join("; ") || "Not provided"}`,
    "",
    `Examinations: ${studies.map((study) => study.modality).join(", ")}`,
    ...studies.flatMap((study) => [`${study.modality.toUpperCase()} FINDINGS`, ...study.result.observedFindings.map((item) => `- ${item}`), ...(study.result.phasesAvailable?.length ? [`Available phases: ${study.result.phasesAvailable.join(", ")}`] : [])]),
    "",
    "IMPRESSION",
    result.assessment,
    `Differential diagnoses: ${result.differentials.join("; ") || "None listed"}`,
    `Confidence: ${result.confidence} (Illustrative Demo Confidence - Not Clinically Validated)`,
    "",
    "RECOMMENDATIONS",
    ...result.recommendations.flatMap((item) => [`${item.priority}: ${item.modality}`, item.rationale, `Expected contribution: ${item.expectedContribution}`, `Safety: ${item.safety}`, `Alternatives: ${item.alternatives.join(", ")}`]),
    ...(result.safetyNotices.length ? ["", "SAFETY NOTICES", ...result.safetyNotices] : []),
    "",
    "LIMITATIONS",
    ...result.limitations,
    ...result.missingEvidence.map((item) => `Missing evidence: ${item}`),
    "",
    `Clinician review: ${report.reviewDecision}`,
    report.clinicianNote || "No clinician note entered.",
  ].flatMap((row) => wrap(row));

  const pages: string[][] = [];
  for (let i = 0; i < rows.length; i += 47) pages.push(rows.slice(i, i + 47));
  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  const pageIds = pages.map((_, index) => 4 + index * 2);
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  pages.forEach((page, index) => {
    const pageId = 4 + index * 2;
    const contentId = pageId + 1;
    const body = `BT\n/F1 10 Tf\n54 760 Td\n14 TL\n${page.map((line, lineIndex) => `${lineIndex ? "T* " : ""}(${clean(line)}) Tj`).join("\n")}\nET`;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${body.length} >>\nstream\n${body}\nendstream`;
  });
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let id = 1; id < objects.length; id++) { offsets[id] = pdf.length; pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`; }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}
