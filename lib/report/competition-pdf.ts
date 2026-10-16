import { SCORE_DISCLAIMER } from "@/data/diagnostic-scores";
import type { ClinicalModality, CompetitionCase, GlandExam, HistoryAnswers, ScoreFixture } from "@/types/competition";

export interface CompetitionReportInput {
  kind: ClinicalModality | "fusion" | "complete";
  demoCase: CompetitionCase;
  history: HistoryAnswers;
  exam: GlandExam;
  includedModalities: ClinicalModality[];
  scores?: ScoreFixture[];
}

const ascii = (value: string) => value.normalize("NFKD").replace(/[^\x20-\x7E]/g, "-").replace(/[()\\]/g, "\\$&");
const wrap = (value: string, width = 88) => {
  const words = ascii(value).split(/\s+/); const lines: string[] = []; let line = "";
  for (const word of words) { if (`${line} ${word}`.trim().length > width) { if (line) lines.push(line); line = word; } else line = `${line} ${word}`.trim(); }
  if (line) lines.push(line); return lines;
};

function fixtureFor(input: CompetitionReportInput, modality: ClinicalModality) {
  return input.demoCase[modality];
}

function sialographyRows(input: CompetitionReportInput) {
  const supplied = Object.keys(input.exam.phaseUploads);
  return [
    "CLINICAL INDICATION", input.demoCase.clinicalSummary,
    "TECHNIQUE AND AVAILABLE PHASES", supplied.length ? `User-supplied phase images: ${supplied.join(", ")}.` : "No phase images supplied. Educational scenario findings await image verification.",
    ...Object.values(input.demoCase.sialographyPhases).flatMap((phase) => [
      `${phase.label.toUpperCase()}${phase.timing ? ` - ${phase.timing}` : ""}`,
      ...(phase.findings.length ? phase.findings.map((item) => `- ${item}`) : ["- No phase finding is asserted."]),
      `Phase interpretation: ${phase.interpretation}`,
      ...phase.limitations.map((item) => `Phase limitation: ${item}`),
    ]),
    "OVERALL IMPRESSION", input.demoCase.sialography.interpretation,
    "DIFFERENTIAL DIAGNOSES", ...input.demoCase.sialography.differentials.map((item) => `- ${item.label}: ${item.rationale}`),
    "CLINICAL RECOMMENDATIONS", ...input.demoCase.sialography.recommendations.map((item) => `- ${item}`),
    "STUDY LIMITATIONS", ...input.demoCase.sialography.limitations.map((item) => `- ${item}`), "",
  ];
}

export function createCompetitionPdf(input: CompetitionReportInput): Uint8Array {
  const title = input.kind === "complete" ? "Complete Case Report" : input.kind === "fusion" ? "Multimodal Fusion Report" : `${input.kind === "sialography" ? "2D Sialography" : input.kind === "cbct" ? "3D CBCT" : "Ultrasound"} Report`;
  const modalities = input.kind === "complete" || input.kind === "fusion" ? input.includedModalities : [input.kind as ClinicalModality];
  const rows = [
    `SaliFusion - ${title}`,
    "EDUCATIONAL DEMONSTRATION - NOT FOR CLINICAL DIAGNOSIS",
    "",
    `Case: ${input.demoCase.number} - ${input.demoCase.title}`,
    `Patient fixture: ${input.history.age || "Unknown"} years / ${input.history.sex}`,
    `Target: ${input.exam.side} ${input.exam.gland}`,
    `Clinical summary: ${input.demoCase.clinicalSummary}`,
    "",
    ...modalities.flatMap((modality) => {
      if (modality === "sialography") return sialographyRows(input);
      const fixture = fixtureFor(input, modality);
      return [
        `${modality.toUpperCase()} - OBSERVED FINDINGS`,
        ...(fixture.observedFindings.length ? fixture.observedFindings.map((item) => `- ${item}`) : ["No supported findings documented."]),
        "INTERPRETATION", fixture.interpretation,
        "DIFFERENTIAL DIAGNOSIS", ...fixture.differentials.map((item) => `- ${item.label}: ${item.rationale}${item.opposingEvidence ? ` Opposing: ${item.opposingEvidence}` : ""}`),
        "LIMITATIONS", ...fixture.limitations.map((item) => `- ${item}`),
        "RECOMMENDATIONS", ...fixture.recommendations.map((item) => `- ${item}`), "",
      ];
    }),
    ...(input.kind === "fusion" || input.kind === "complete" ? ["FUSION INTERPRETATION", input.demoCase.fusion.interpretation, "", "ILLUSTRATIVE DIAGNOSTIC SUPPORT SCORES", SCORE_DISCLAIMER, ...(input.scores ?? []).map((score) => `${score.label}: ${score.score}% - ${score.rationale}`)] : []),
    "", "DATA PROVENANCE", "Preset findings are scenario reference findings until the matching media is supplied and reviewed. User uploads are not analyzed by a validated model.",
    "", `Generated: ${new Date().toISOString()}`,
  ].flatMap((row) => wrap(row));
  const pages: string[][] = []; for (let i = 0; i < rows.length; i += 46) pages.push(rows.slice(i, i + 46));
  const objects: string[] = []; objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  const pageIds = pages.map((_, index) => 4 + index * 2); objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`; objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  pages.forEach((page, index) => { const pageId = 4 + index * 2; const contentId = pageId + 1; const body = `BT\n/F1 9 Tf\n54 760 Td\n14 TL\n${page.map((line, lineIndex) => `${lineIndex ? "T* " : ""}(${ascii(line)}) Tj`).join("\n")}\nET`; objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`; objects[contentId] = `<< /Length ${body.length} >>\nstream\n${body}\nendstream`; });
  let pdf = "%PDF-1.4\n"; const offsets: number[] = [0]; for (let id = 1; id < objects.length; id += 1) { offsets[id] = pdf.length; pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`; }
  const xref = pdf.length; pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`; for (let id = 1; id < objects.length; id += 1) pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`; return new TextEncoder().encode(pdf);
}
