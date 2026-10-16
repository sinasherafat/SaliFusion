import { SCORE_DISCLAIMER } from "@/data/diagnostic-scores";
import type { ClinicalModality, CompetitionCase, GlandExam, HistoryAnswers, ScoreFixture } from "@/types/competition";

export interface ReportMedia {
  label: string;
  bytes: Uint8Array;
  width: number;
  height: number;
}

export interface CompetitionReportInput {
  kind: ClinicalModality | "fusion" | "complete";
  demoCase: CompetitionCase;
  history: HistoryAnswers;
  exam: GlandExam;
  includedModalities: ClinicalModality[];
  scores?: ScoreFixture[];
  media?: ReportMedia[];
}

const encoder = new TextEncoder();
const ascii = (value: string) => value.normalize("NFKD").replace(/[^\x20-\x7E]/g, "-").replace(/[()\\]/g, "\\$&");
const wrap = (value: string, width = 88) => {
  const words = ascii(value).split(/\s+/); const lines: string[] = []; let line = "";
  for (const word of words) { if (`${line} ${word}`.trim().length > width) { if (line) lines.push(line); line = word; } else line = `${line} ${word}`.trim(); }
  if (line) lines.push(line); return lines;
};

function fixtureFor(input: CompetitionReportInput, modality: ClinicalModality) { return input.demoCase[modality]; }

function sialographyRows(input: CompetitionReportInput) {
  const supplied = Object.keys(input.exam.phaseUploads);
  return [
    "CLINICAL INDICATION", input.demoCase.clinicalSummary,
    "TECHNIQUE AND AVAILABLE PHASES", supplied.length ? `Available phase images: ${supplied.join(", ")}.` : "No phase images supplied. Educational scenario findings await image verification.",
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

function concat(parts: Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0; for (const part of parts) { result.set(part, offset); offset += part.length; } return result;
}

function streamObject(dictionary: string, stream: Uint8Array) {
  return concat([encoder.encode(`<< ${dictionary} /Length ${stream.length} >>\nstream\n`), stream, encoder.encode("\nendstream")]);
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
    "", "DATA PROVENANCE", input.media?.length ? `This report embeds ${input.media.length} media item(s) available in the active examination. Interpretations remain clinician-review educational content.` : "No reportable media were embedded. Preset findings are educational scenario references, not automated analysis of arbitrary uploads.",
    "", `Generated: ${new Date().toISOString()}`,
  ].flatMap((row) => wrap(row));

  const textPages: string[][] = []; for (let i = 0; i < rows.length; i += 46) textPages.push(rows.slice(i, i + 46));
  const media = input.media ?? [];
  let nextId = 4;
  const textRefs = textPages.map(() => ({ page: nextId++, content: nextId++ }));
  const mediaRefs = media.map(() => ({ page: nextId++, content: nextId++, image: nextId++ }));
  const objects: Uint8Array[] = new Array(nextId);
  const pageIds = [...textRefs.map((item) => item.page), ...mediaRefs.map((item) => item.page)];
  objects[1] = encoder.encode("<< /Type /Catalog /Pages 2 0 R >>");
  objects[2] = encoder.encode(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
  objects[3] = encoder.encode("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  textPages.forEach((page, index) => {
    const ref = textRefs[index];
    const body = encoder.encode(`BT\n/F1 9 Tf\n54 760 Td\n14 TL\n${page.map((line, lineIndex) => `${lineIndex ? "T* " : ""}(${ascii(line)}) Tj`).join("\n")}\nET`);
    objects[ref.page] = encoder.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${ref.content} 0 R >>`);
    objects[ref.content] = streamObject("", body);
  });

  media.forEach((item, index) => {
    const ref = mediaRefs[index];
    const maxWidth = 504; const maxHeight = 650; const scale = Math.min(maxWidth / item.width, maxHeight / item.height);
    const width = item.width * scale; const height = item.height * scale; const x = (612 - width) / 2; const y = 48 + (maxHeight - height) / 2;
    const body = encoder.encode(`BT /F1 11 Tf 54 752 Td (${ascii(item.label)}) Tj ET\nq ${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im1 Do Q`);
    objects[ref.page] = encoder.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> /XObject << /Im1 ${ref.image} 0 R >> >> /Contents ${ref.content} 0 R >>`);
    objects[ref.content] = streamObject("", body);
    objects[ref.image] = streamObject(`/Type /XObject /Subtype /Image /Width ${item.width} /Height ${item.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`, item.bytes);
  });

  const parts: Uint8Array[] = [encoder.encode("%PDF-1.4\n%SaliFusion\n")]; const offsets: number[] = new Array(objects.length).fill(0); let length = parts[0].length;
  for (let id = 1; id < objects.length; id += 1) { offsets[id] = length; const object = concat([encoder.encode(`${id} 0 obj\n`), objects[id], encoder.encode("\nendobj\n")]); parts.push(object); length += object.length; }
  const xref = length; let tail = `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) tail += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  tail += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  parts.push(encoder.encode(tail)); return concat(parts);
}
