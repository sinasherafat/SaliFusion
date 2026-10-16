import { SCORE_DISCLAIMER } from "@/data/diagnostic-scores";
import type { ClinicalModality, CompetitionCase, GlandExam, HistoryAnswers, ScoreFixture, SialographyPhase } from "@/types/competition";

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
  fusionImpression?: string;
  fusionReviewed?: boolean;
}

type FontName = "F1" | "F2" | "F3";
type PdfPage = { commands: string[]; images: PlacedImage[] };
type PlacedImage = { media: ReportMedia; x: number; y: number; width: number; height: number; resourceName: string };

const encoder = new TextEncoder();
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const LEFT = 48;
const RIGHT = 547;
const TOP = 772;
const BOTTOM = 62;
const phaseOrder: SialographyPhase[] = ["precontrast", "ductal", "acinar", "evacuation"];
const color = { ink: "0.10 0.16 0.18", muted: "0.36 0.43 0.44", teal: "0.04 0.43 0.40", tealSoft: "0.91 0.97 0.96", line: "0.83 0.87 0.87", amber: "0.55 0.36 0.10", white: "1 1 1" };

function safe(value: string) { return value.normalize("NFKD").replace(/[\u2010-\u2015]/g, "-").replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim().replace(/[()\\]/g, "\\$&"); }
function concat(parts: Uint8Array[]) { const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0)); let offset = 0; for (const part of parts) { output.set(part, offset); offset += part.length; } return output; }
function streamObject(dictionary: string, stream: Uint8Array) { return concat([encoder.encode(`<< ${dictionary} /Length ${stream.length} >>\nstream\n`), stream, encoder.encode("\nendstream")]); }
function text(value: string, x: number, y: number, size = 9.5, font: FontName = "F1", fill = color.ink) { return `BT /${font} ${size} Tf ${fill} rg 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${safe(value)}) Tj ET`; }
function line(x1: number, y1: number, x2: number, y2: number, stroke = color.line, width = .6) { return `${stroke} RG ${width} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`; }
function fillRect(x: number, y: number, width: number, height: number, fill: string) { return `${fill} rg ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f`; }
function strokeRect(x: number, y: number, width: number, height: number, stroke = color.line) { return `${stroke} RG .6 w ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S`; }
function wrap(value: string, width: number, size: number) {
  const max = Math.max(18, Math.floor(width / (size * .52))); const words = safe(value).split(" "); const rows: string[] = []; let current = "";
  for (const word of words) { const next = `${current} ${word}`.trim(); if (next.length > max && current) { rows.push(current); current = word; } else current = next; }
  if (current) rows.push(current); return rows;
}

class Layout {
  pages: PdfPage[] = [];
  page!: PdfPage;
  y = TOP;
  constructor() { this.newPage(); }
  newPage() { this.page = { commands: [], images: [] }; this.pages.push(this.page); this.y = TOP; }
  ensure(height: number) { if (this.y - height < BOTTOM) this.newPage(); }
  space(height = 8) { this.y -= height; }
  heading(value: string) { this.ensure(34); this.page.commands.push(text(value.toUpperCase(), LEFT, this.y, 9, "F2", color.teal), line(LEFT, this.y - 7, RIGHT, this.y - 7)); this.y -= 22; }
  paragraph(value: string, options: { size?: number; font?: FontName; color?: string; indent?: number; gap?: number } = {}) {
    const size = options.size ?? 9.5; const font = options.font ?? "F1"; const fill = options.color ?? color.ink; const indent = options.indent ?? 0; const leading = size * 1.45; const rows = wrap(value, RIGHT - LEFT - indent, size); this.ensure(rows.length * leading + 4);
    for (const row of rows) { this.page.commands.push(text(row, LEFT + indent, this.y, size, font, fill)); this.y -= leading; }
    this.y -= options.gap ?? 5;
  }
  list(items: string[]) { for (const item of items) { const rows = wrap(item, RIGHT - LEFT - 18, 9.3); this.ensure(rows.length * 13.2 + 3); this.page.commands.push(text("-", LEFT + 2, this.y, 9.3, "F2", color.teal)); for (let i = 0; i < rows.length; i += 1) { this.page.commands.push(text(rows[i], LEFT + 16, this.y, 9.3, "F1", color.ink)); this.y -= 13.2; } this.y -= 2; } this.y -= 3; }
  labelValue(label: string, value: string) { this.ensure(28); this.page.commands.push(text(label.toUpperCase(), LEFT, this.y, 7.5, "F2", color.muted)); this.y -= 12; this.paragraph(value, { size: 9.3, gap: 7 }); }
}

function reportTitle(kind: CompetitionReportInput["kind"]) { return kind === "complete" ? "Complete Case Report" : kind === "fusion" ? "Integrated Multimodal Fusion Report" : kind === "sialography" ? "Four-Phase Sialography Report" : kind === "cbct" ? "CBCT Report" : "Ultrasound Report"; }
function modalitiesFor(input: CompetitionReportInput) { return input.kind === "fusion" || input.kind === "complete" ? input.includedModalities : [input.kind as ClinicalModality]; }
function modalityLabel(modality: ClinicalModality) { return modality === "sialography" ? "Four-Phase Sialography" : modality === "cbct" ? "CBCT" : "Ultrasound B-mode"; }

function addOpening(layout: Layout, input: CompetitionReportInput) {
  layout.page.commands.push(fillRect(LEFT, 694, RIGHT - LEFT, 70, color.tealSoft));
  layout.page.commands.push(text("Clinical Imaging Assessment Report", LEFT + 18, 738, 20, "F2", color.ink));
  layout.page.commands.push(text(reportTitle(input.kind), LEFT + 18, 714, 11, "F1", color.teal));
  layout.y = 670;
  layout.paragraph(`Case ${input.demoCase.number}`, { size: 12, font: "F2", color: color.teal, gap: 2 });
  layout.paragraph("Left Submandibular Sialolithiasis with Obstructive Ductal Disease", { size: 17, font: "F2", gap: 14 });
  const modalities = modalitiesFor(input).map(modalityLabel).join(", ");
  const fields = [
    ["Demo case identifier", `Case ${input.demoCase.number}`], ["Affected gland", `${input.exam.side} ${input.exam.gland}`],
    ["Examination modalities", modalities || "No reviewed modality"], ["Report generation date", new Date().toISOString().slice(0, 10)],
    ["Review status", input.fusionReviewed ? "Clinician reviewed educational draft" : "Educational draft - clinician review required"], ["Use status", "Educational / research demonstration"],
  ];
  const columnWidth = (RIGHT - LEFT - 12) / 2;
  fields.forEach(([label, value], index) => { const column = index % 2; const row = Math.floor(index / 2); const x = LEFT + column * (columnWidth + 12); const y = layout.y - row * 50; layout.page.commands.push(strokeRect(x, y - 36, columnWidth, 42), text(label.toUpperCase(), x + 10, y - 13, 7, "F2", color.muted)); const valueRows = wrap(value, columnWidth - 20, 8.5).slice(0, 2); valueRows.forEach((entry, rowIndex) => layout.page.commands.push(text(entry, x + 10, y - 26 - rowIndex * 10, 8.5, "F1", color.ink))); });
  layout.y -= 162;
}

function addModality(layout: Layout, input: CompetitionReportInput, modality: ClinicalModality) {
  const fixture = input.demoCase[modality];
  layout.heading(modality === "sialography" ? "Four-Phase Sialography Assessment" : `${modalityLabel(modality)} Assessment`);
  layout.labelValue("Evidence status", input.exam.clinicianVerified[modality] ? "Clinician-confirmed observation" : "Curated educational reference reviewed against browser-local media; direct clinician confirmation remains required.");
  if (modality === "sialography") {
    layout.labelValue("Technique and available phases", phaseOrder.map((phase) => `${input.demoCase.sialographyPhases[phase].label}: ${input.exam.phaseUploads[phase] ? "available" : "missing"}`).join("; "));
    for (const phase of phaseOrder) { const phaseFixture = input.demoCase.sialographyPhases[phase]; layout.heading(`${phaseFixture.label}${phaseFixture.timing ? ` - ${phaseFixture.timing}` : ""}`); layout.list(phaseFixture.findings.length ? phaseFixture.findings : ["No image-derived finding is asserted."]); layout.paragraph(phaseFixture.interpretation); for (const limitation of phaseFixture.limitations) layout.paragraph(`Limitation: ${limitation}`, { size: 8.5, color: color.muted }); }
  } else {
    layout.heading("Observed Findings"); layout.list(fixture.observedFindings.length ? fixture.observedFindings : ["No supported findings documented."]);
  }
  layout.heading("Imaging Interpretation"); layout.paragraph(fixture.interpretation, { size: 10.2, font: "F2" });
  layout.heading("Differential Diagnoses"); layout.list(fixture.differentials.map((item) => `${item.label}: ${item.rationale}${item.opposingEvidence ? ` Opposing evidence: ${item.opposingEvidence}` : ""}`));
  layout.heading("Limitations"); layout.list(fixture.limitations);
  layout.heading("Recommendations"); layout.list(fixture.recommendations);
}

function addFusion(layout: Layout, input: CompetitionReportInput) {
  const impression = input.fusionImpression || input.demoCase.fusion.interpretation;
  layout.heading("Integrated Multimodal Assessment");
  layout.labelValue("Clinical history", input.demoCase.clinicalSummary);
  layout.labelValue("Ultrasound contribution", input.demoCase.ultrasound.interpretation);
  for (const phase of phaseOrder) layout.labelValue(input.demoCase.sialographyPhases[phase].label, input.demoCase.sialographyPhases[phase].interpretation);
  layout.heading("Cross-Modal Concordance"); layout.list(input.demoCase.fusion.observedFindings.slice(0, 2));
  layout.heading("Complementary Findings"); layout.list(input.demoCase.fusion.observedFindings.slice(1));
  layout.heading("Final Imaging Impression"); layout.paragraph(impression, { size: 11, font: "F2" });
  layout.heading("Differential Diagnoses"); layout.list(input.demoCase.fusion.differentials.map((item) => `${item.label}: ${item.rationale}`));
  layout.heading("Clinical Recommendations"); layout.list(["Ductal mapping may add value when it would change specialist or sialendoscopic planning.", ...input.demoCase.fusion.recommendations]);
  layout.heading("Safety Precautions"); layout.paragraph("Pressurized retrograde contrast injection may displace an impacted distal calculus. Confirm the management question and apply the relevant specialist protocol before invasive ductal imaging.", { color: color.amber });
  layout.heading("Educational Decision Support"); layout.paragraph(SCORE_DISCLAIMER, { size: 8.6, color: color.muted });
}

function findingForMedia(input: CompetitionReportInput, label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes("ultrasound")) return input.demoCase.ultrasound.interpretation;
  const phase = normalized.includes("scout") ? "precontrast" : normalized.includes("ductal") ? "ductal" : normalized.includes("acinar") ? "acinar" : "evacuation";
  return input.demoCase.sialographyPhases[phase].interpretation;
}

function placeMedia(page: PdfPage, media: ReportMedia, top: number, maxHeight: number, resourceName: string, finding: string) {
  const maxWidth = RIGHT - LEFT - 24; const scale = Math.min(maxWidth / Math.max(media.width, 1), maxHeight / Math.max(media.height, 1)); const width = media.width * scale; const height = media.height * scale; const x = (PAGE_WIDTH - width) / 2; const y = top - height;
  page.commands.push(text(media.label, LEFT, top + 18, 10, "F2", color.ink), strokeRect(x - 3, y - 3, width + 6, height + 6));
  page.images.push({ media, x, y, width, height, resourceName });
  const findingRows = wrap(`Phase-specific assessment: ${finding}`, RIGHT - LEFT, 8.2).slice(0, 3); findingRows.forEach((row, index) => page.commands.push(text(row, LEFT, y - 18 - index * 10.5, 8.2, "F1", color.muted)));
}

function addMediaPages(layout: Layout, input: CompetitionReportInput) {
  const media = input.media ?? [];
  if (!media.length) { layout.heading("Media Documentation"); layout.paragraph("Missing image: no browser-local reportable media were available when this PDF was generated. Re-import the source files and regenerate the report.", { color: color.amber }); return; }
  const ultrasound = media.filter((item) => item.label.toLowerCase().includes("ultrasound")); const phases = media.filter((item) => !item.label.toLowerCase().includes("ultrasound"));
  for (const item of ultrasound) { layout.newPage(); layout.page.commands.push(text("Representative Ultrasound Frame", LEFT, 760, 13, "F2", color.teal)); placeMedia(layout.page, item, 710, 520, "Im1", findingForMedia(input, item.label)); }
  for (let index = 0; index < phases.length; index += 2) { layout.newPage(); layout.page.commands.push(text("Four-Phase Sialography Image Review", LEFT, 760, 13, "F2", color.teal)); const pair = phases.slice(index, index + 2); pair.forEach((item, pairIndex) => placeMedia(layout.page, item, pairIndex === 0 ? 700 : 365, 245, `Im${pairIndex + 1}`, findingForMedia(input, item.label))); }
}

function headerFooter(pageNumber: number, pageCount: number, input: CompetitionReportInput) {
  return [
    text("SaliFusion", LEFT, 814, 13, "F2", color.teal),
    text("AI-Assisted Salivary Gland Imaging and Diagnostic Decision Support", LEFT + 77, 814, 7.8, "F1", color.muted),
    line(LEFT, 801, RIGHT, 801, color.teal, 1),
    line(LEFT, 42, RIGHT, 42),
    text("Educational Research Demonstration - Not Clinically Validated", LEFT, 25, 7.5, "F1", color.muted),
    text(`Case ${input.demoCase.number}  |  ${reportTitle(input.kind)}`, 300, 25, 7.5, "F1", color.muted),
    text(`Page ${pageNumber} of ${pageCount}`, 505, 25, 7.5, "F2", color.ink),
  ];
}

export function createCompetitionPdf(input: CompetitionReportInput): Uint8Array {
  const layout = new Layout(); addOpening(layout, input);
  layout.heading("Relevant Clinical History"); layout.paragraph(input.demoCase.clinicalSummary);
  const modalities = modalitiesFor(input);
  for (const modality of modalities) addModality(layout, input, modality);
  if (input.kind === "fusion" || input.kind === "complete") addFusion(layout, input);
  layout.heading("Data Provenance"); layout.paragraph("Clinical media were read from browser-local object URLs and embedded client-side. Preset educational references remain distinct from clinician-confirmed observations. No automated analysis of arbitrary uploads or clinically validated performance is claimed.", { size: 8.8, color: color.muted });
  addMediaPages(layout, input);

  let nextId = 6;
  const references = layout.pages.map((page) => ({ page: nextId++, content: nextId++, images: page.images.map(() => nextId++) }));
  const objects: Uint8Array[] = new Array(nextId);
  objects[1] = encoder.encode("<< /Type /Catalog /Pages 2 0 R >>");
  objects[2] = encoder.encode(`<< /Type /Pages /Kids [${references.map((ref) => `${ref.page} 0 R`).join(" ")}] /Count ${references.length} >>`);
  objects[3] = encoder.encode("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects[4] = encoder.encode("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  objects[5] = encoder.encode("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>");

  layout.pages.forEach((page, pageIndex) => {
    const ref = references[pageIndex]; const imageCommands = page.images.map((image) => `q ${image.width.toFixed(2)} 0 0 ${image.height.toFixed(2)} ${image.x.toFixed(2)} ${image.y.toFixed(2)} cm /${image.resourceName} Do Q`);
    const body = encoder.encode([...page.commands, ...imageCommands, ...headerFooter(pageIndex + 1, layout.pages.length, input)].join("\n"));
    const xObjects = page.images.length ? `/XObject << ${page.images.map((image, index) => `/${image.resourceName} ${ref.images[index]} 0 R`).join(" ")} >>` : "";
    objects[ref.page] = encoder.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> ${xObjects} >> /Contents ${ref.content} 0 R >>`);
    objects[ref.content] = streamObject("", body);
    page.images.forEach((image, index) => { objects[ref.images[index]] = streamObject(`/Type /XObject /Subtype /Image /Width ${image.media.width} /Height ${image.media.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`, image.media.bytes); });
  });

  const parts: Uint8Array[] = [encoder.encode("%PDF-1.4\n%SaliFusion\n")]; const offsets = new Array(objects.length).fill(0); let length = parts[0].length;
  for (let id = 1; id < objects.length; id += 1) { offsets[id] = length; const object = concat([encoder.encode(`${id} 0 obj\n`), objects[id], encoder.encode("\nendobj\n")]); parts.push(object); length += object.length; }
  const xref = length; let tail = `xref\n0 ${objects.length}\n0000000000 65535 f \n`; for (let id = 1; id < objects.length; id += 1) tail += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  tail += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`; parts.push(encoder.encode(tail)); return concat(parts);
}
