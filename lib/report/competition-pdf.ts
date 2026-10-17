import { SCORE_DISCLAIMER } from "@/data/diagnostic-scores";
import { getDuctalRecommendation } from "@/lib/clinical/competition-rules";
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
  reportReviewed?: boolean;
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

function safe(value: string) { return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[\u2010-\u2015]/g, "-").replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim().replace(/[()\\]/g, "\\$&"); }
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
  heading(value: string) { this.ensure(60); this.page.commands.push(text(value.toUpperCase(), LEFT, this.y, 9, "F2", color.teal), line(LEFT, this.y - 7, RIGHT, this.y - 7)); this.y -= 22; }
  paragraph(value: string, options: { size?: number; font?: FontName; color?: string; indent?: number; gap?: number } = {}) {
    const size = options.size ?? 9.5; const font = options.font ?? "F1"; const fill = options.color ?? color.ink; const indent = options.indent ?? 0; const leading = size * 1.45; const rows = wrap(value, RIGHT - LEFT - indent, size); this.ensure(rows.length * leading + 4);
    for (const row of rows) { this.page.commands.push(text(row, LEFT + indent, this.y, size, font, fill)); this.y -= leading; }
    this.y -= options.gap ?? 5;
  }
  list(items: string[]) { for (const item of items) { const rows = wrap(item, RIGHT - LEFT - 18, 9.3); this.ensure(rows.length * 13.2 + 3); this.page.commands.push(text("-", LEFT + 2, this.y, 9.3, "F2", color.teal)); for (let i = 0; i < rows.length; i += 1) { this.page.commands.push(text(rows[i], LEFT + 16, this.y, 9.3, "F1", color.ink)); this.y -= 13.2; } this.y -= 2; } this.y -= 3; }
  labelValue(label: string, value: string) { this.ensure(28); this.page.commands.push(text(label.toUpperCase(), LEFT, this.y, 7.5, "F2", color.muted)); this.y -= 12; this.paragraph(value, { size: 9.3, gap: 7 }); }
}

function reportTitle(input: CompetitionReportInput) { if (input.demoCase.id === "case-02") return input.kind === "complete" ? "Case 02 - Complete Imaging Report" : input.kind === "fusion" ? "Case 02 - Integrated Clinical and Ultrasound Assessment" : "Case 02 - Bilateral Parotid Ultrasound and Doppler Examination"; const kind = input.kind; return kind === "complete" ? "Complete Case Report" : kind === "fusion" ? "Integrated Multimodal Fusion Report" : kind === "sialography" ? "Four-Phase Sialography Report" : kind === "cbct" ? "CBCT Report" : "Ultrasound Report"; }
function modalitiesFor(input: CompetitionReportInput) { return input.kind === "fusion" || input.kind === "complete" ? input.includedModalities : [input.kind as ClinicalModality]; }
function modalityLabel(modality: ClinicalModality) { return modality === "sialography" ? "Four-Phase Sialography" : modality === "cbct" ? "CBCT" : "Ultrasound B-mode"; }
function caseTwoHistory(history: HistoryAnswers) { const parts = [`${history.symptomDuration || "Duration not documented"} ${history.onset || "unknown-onset"} ${history.laterality} ${history.gland} swelling`, `pain ${history.pain}`, `erythema/local warmth ${history.rednessWarmth}`, `purulent discharge ${history.purulentDischarge}`, `xerostomia ${history.xerostomia}`, `xerophthalmia ${history.xerophthalmia}`, `fever ${history.fever}`]; return parts.join("; ") + "."; }

function addOpening(layout: Layout, input: CompetitionReportInput) {
  layout.page.commands.push(fillRect(LEFT, 682, RIGHT - LEFT, 82, color.tealSoft));
  layout.page.commands.push(text("SaliFusion", LEFT + 18, 741, 20, "F2", color.ink));
  layout.page.commands.push(text("AI-Assisted Salivary Gland Imaging and Diagnostic Decision Support", LEFT + 18, 725, 8.2, "F1", color.muted));
  wrap(reportTitle(input), RIGHT - LEFT - 36, 10.2).slice(0, 2).forEach((row, index) => layout.page.commands.push(text(row, LEFT + 18, 705 - index * 12, 10.2, "F2", color.teal)));
  layout.y = 660;
  layout.paragraph(`Case ${input.demoCase.number}`, { size: 12, font: "F2", color: color.teal, gap: 2 });
  layout.paragraph(input.demoCase.id === "case-02" ? "Acute Left Parotitis" : input.demoCase.id === "case-01" ? "Left Submandibular Sialolithiasis with Obstructive Ductal Disease" : input.demoCase.title, { size: 17, font: "F2", gap: 14 });
  const modalities = input.demoCase.id === "case-02" ? "B-mode + Doppler Imaging" : modalitiesFor(input).map(modalityLabel).join(", ");
  const reviewStatus = input.reportReviewed ? "Clinician reviewed educational report" : input.media?.length ? "Educational draft - not yet clinician reviewed" : "Educational draft - image verification has not occurred";
  const fields = [
    ["Demo case identifier", `Case ${input.demoCase.number}`], ["Affected gland", input.demoCase.id === "case-02" ? "Bilateral parotid comparison; symptomatic left gland" : `${input.exam.side} ${input.exam.gland}`],
    ["Examination modalities", modalities || "No reviewed modality"], ["Report generation date", new Date().toISOString().slice(0, 10)],
    ["Review status", reviewStatus], ["Use status", "Educational / research demonstration"],
  ];
  const columnWidth = (RIGHT - LEFT - 12) / 2;
  fields.forEach(([label, value], index) => { const column = index % 2; const row = Math.floor(index / 2); const x = LEFT + column * (columnWidth + 12); const y = layout.y - row * 50; layout.page.commands.push(strokeRect(x, y - 36, columnWidth, 42), text(label.toUpperCase(), x + 10, y - 13, 7, "F2", color.muted)); const valueRows = wrap(value, columnWidth - 20, 8.5).slice(0, 2); valueRows.forEach((entry, rowIndex) => layout.page.commands.push(text(entry, x + 10, y - 26 - rowIndex * 10, 8.5, "F1", color.ink))); });
  layout.y -= 162;
}

function addCaseTwoUltrasound(layout: Layout, input: CompetitionReportInput) {
  const safety = getDuctalRecommendation(input.demoCase.id, input.history);
  layout.heading("Clinical Indication"); layout.paragraph("Acute left parotid swelling, pain, and erythema. Comparative bilateral parotid B-mode and Doppler Imaging assessment.");
  layout.heading("Relevant History"); layout.paragraph(caseTwoHistory(input.history));
  layout.heading("Technique"); layout.paragraph("One prerecorded four-panel composite ultrasound video was reviewed. Upper-left: right parotid B-mode. Upper-right: right parotid Doppler Imaging. Lower-left: left parotid B-mode. Lower-right: left parotid Doppler Imaging. The exact Color versus Power Doppler technique is not asserted without reliable metadata. This is not ultrasound-sialography fusion.");
  layout.heading("Right Parotid - B-mode"); layout.paragraph("The right parotid gland demonstrates relatively homogeneous parenchymal echotexture within the provided images, without the conspicuous multifocal hypoechoic changes observed in the contralateral gland.");
  layout.heading("Left Parotid - B-mode"); layout.paragraph("The left parotid gland demonstrates multiple relatively uniform rounded hypoechoic areas distributed within the parenchyma, producing a heterogeneous, pomegranate-like sonographic appearance. This descriptive pattern is nonspecific.");
  layout.heading("Right Parotid - Doppler Imaging"); layout.paragraph("The right parotid gland demonstrates comparatively less prominent Doppler vascular signal than the symptomatic left gland in the supplied examination.");
  layout.heading("Left Parotid - Doppler Imaging"); layout.paragraph("The symptomatic left parotid gland demonstrates increased Doppler vascular signals relative to the contralateral reference gland, supporting active glandular hyperemia in the appropriate clinical context. Doppler alone does not establish infection.");
  layout.heading("Comparison Findings"); layout.list(input.demoCase.ultrasound.observedFindings);
  layout.heading("Integrated Ultrasound Impression"); layout.paragraph(input.demoCase.ultrasound.interpretation, { size: 10.2, font: "F2" });
  layout.heading("Differential Diagnoses"); layout.list(input.demoCase.ultrasound.differentials.map((item) => `${item.label}: ${item.rationale}${item.opposingEvidence ? ` Opposing evidence: ${item.opposingEvidence}` : ""}`));
  layout.heading("Safety Assessment"); layout.paragraph(`${safety.title}. ${safety.explanation}`, { color: safety.state === "defer" ? color.amber : color.ink });
  layout.heading("Recommendations"); layout.list([...input.demoCase.ultrasound.recommendations, ...safety.considerations]);
  layout.heading("Examination Limitations"); layout.list(input.demoCase.ultrasound.limitations);
  layout.heading("Final Impression"); layout.paragraph("Acute Left Parotitis / Acute Sialadenitis. Comparative B-mode and Doppler findings favor acute inflammatory involvement of the symptomatic left parotid gland. Definite bacterial infection and abscess are not established by this short video.", { size: 10.5, font: "F2" });
}

function addModality(layout: Layout, input: CompetitionReportInput, modality: ClinicalModality) {
  if (input.demoCase.id === "case-02" && modality === "ultrasound") { addCaseTwoUltrasound(layout, input); return; }
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
  const limitations = modality === "ultrasound" && Object.keys(input.exam.ultrasoundUploads).length
    ? fixture.limitations.map((item) => item.includes("awaiting user-supplied media") ? "Browser-local ultrasound media are available; educational reference findings remain unverified until direct clinician assessment." : item)
    : fixture.limitations;
  layout.heading("Limitations"); layout.list(limitations);
  layout.heading("Recommendations"); layout.list(fixture.recommendations);
}

function addFusion(layout: Layout, input: CompetitionReportInput) {
  if (input.demoCase.id === "case-02") {
    const safety = getDuctalRecommendation(input.demoCase.id, input.history); const impression = input.fusionImpression || input.demoCase.fusion.interpretation;
    layout.heading("Integrated Clinical and Ultrasound Assessment"); layout.labelValue("Clinical context", caseTwoHistory(input.history));
    layout.heading("Morphological Observations"); layout.list(["Left parotid heterogeneity with multiple rounded hypoechoic areas", "Comparatively preserved right-gland morphology within the demonstrated field"]);
    layout.heading("Vascular Observations"); layout.list(["More prominent Doppler vascular signals in the symptomatic left parotid", "Less conspicuous Doppler vascularity in the contralateral reference gland", "No quantitative vascularity or perfusion index is inferred"]);
    layout.heading("Final Imaging Impression"); layout.paragraph(impression, { size: 11, font: "F2" });
    layout.heading("Differential Diagnoses"); layout.list(input.demoCase.ultrasound.differentials.map((item) => `${item.label}: ${item.rationale}${item.opposingEvidence ? ` Opposing evidence: ${item.opposingEvidence}` : ""}`));
    layout.heading("Abscess Assessment"); layout.paragraph("No definite drainable collection is established from the supplied short comparison video. Targeted examination is recommended if clinical concern persists.");
    layout.heading("Contrast Sialography Safety Decision"); layout.paragraph(`${safety.title}. ${safety.explanation}`, { color: safety.state === "defer" ? color.amber : color.ink }); layout.list(safety.considerations);
    return;
  }
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
  if (input.demoCase.id === "case-02") {
    if (normalized.includes("full four-panel")) return "Original composite frame retained to show the simultaneous bilateral B-mode and Doppler comparison.";
    if (normalized.includes("right parotid") && normalized.includes("b-mode")) return "Relatively homogeneous reference-gland echotexture without the conspicuous multifocal hypoechoic pattern observed on the left.";
    if (normalized.includes("left parotid") && normalized.includes("b-mode")) return "Multiple rounded hypoechoic areas with heterogeneous, pomegranate-like parenchymal appearance.";
    if (normalized.includes("right parotid") && normalized.includes("doppler")) return "Comparatively less conspicuous Doppler vascular signal.";
    return "Increased Doppler vascular signals relative to the contralateral right gland.";
  }
  if (normalized.includes("ultrasound")) return input.demoCase.ultrasound.interpretation;
  const phase = normalized.includes("scout") ? "precontrast" : normalized.includes("ductal") ? "ductal" : normalized.includes("acinar") ? "acinar" : "evacuation";
  return input.demoCase.sialographyPhases[phase].interpretation;
}

function placeMedia(page: PdfPage, media: ReportMedia, top: number, maxHeight: number, resourceName: string, finding: string) {
  const maxWidth = RIGHT - LEFT - 24; const scale = Math.min(maxWidth / Math.max(media.width, 1), maxHeight / Math.max(media.height, 1)); const width = media.width * scale; const height = media.height * scale; const x = (PAGE_WIDTH - width) / 2; const y = top - height;
  page.commands.push(text(media.label, LEFT, top + 18, 10, "F2", color.ink), strokeRect(x - 3, y - 3, width + 6, height + 6));
  page.images.push({ media, x, y, width, height, resourceName });
  const findingRows = wrap(`Image-linked assessment: ${finding}`, RIGHT - LEFT, 8.2).slice(0, 3); findingRows.forEach((row, index) => page.commands.push(text(row, LEFT, y - 18 - index * 10.5, 8.2, "F1", color.muted)));
}

function addMediaPages(layout: Layout, input: CompetitionReportInput) {
  const media = input.media ?? [];
  if (!media.length) { layout.heading("Media Documentation"); layout.paragraph("Missing image: no browser-local reportable media were available when this PDF was generated. Re-import the source files and regenerate the report.", { color: color.amber }); return; }
  if (input.demoCase.id === "case-02") {
    const [composite, ...views] = media; layout.newPage(); layout.page.commands.push(text("Original Composite Ultrasound Frame", LEFT, 760, 13, "F2", color.teal)); placeMedia(layout.page, composite, 710, 500, "Im1", findingForMedia(input, composite.label));
    for (let index = 0; index < views.length; index += 2) { layout.newPage(); layout.page.commands.push(text("Source-Quadrant Comparison Views", LEFT, 760, 13, "F2", color.teal)); views.slice(index, index + 2).forEach((item, pairIndex) => placeMedia(layout.page, item, pairIndex === 0 ? 700 : 365, 245, `Im${pairIndex + 1}`, findingForMedia(input, item.label))); } return;
  }
  const ultrasound = media.filter((item) => item.label.toLowerCase().includes("ultrasound")); const phases = media.filter((item) => !item.label.toLowerCase().includes("ultrasound"));
  for (const item of ultrasound) { layout.newPage(); layout.page.commands.push(text("Representative Ultrasound Frame", LEFT, 760, 13, "F2", color.teal)); placeMedia(layout.page, item, 710, 520, "Im1", findingForMedia(input, item.label)); }
  for (let index = 0; index < phases.length; index += 2) { layout.newPage(); layout.page.commands.push(text("Four-Phase Sialography Image Review", LEFT, 760, 13, "F2", color.teal)); const pair = phases.slice(index, index + 2); pair.forEach((item, pairIndex) => placeMedia(layout.page, item, pairIndex === 0 ? 700 : 365, 245, `Im${pairIndex + 1}`, findingForMedia(input, item.label))); }
}

function headerFooter(pageNumber: number, pageCount: number, input: CompetitionReportInput) {
  const footerTitle = input.demoCase.id === "case-02" ? input.kind === "ultrasound" ? "Bilateral Parotid US Report" : input.kind === "fusion" ? "Integrated Clinical-US Report" : "Case 02 Complete Report" : reportTitle(input).slice(0, 34);
  return [
    text("SaliFusion", LEFT, 814, 13, "F2", color.teal),
    text("AI-Assisted Salivary Gland Imaging and Diagnostic Decision Support", LEFT + 77, 814, 7.8, "F1", color.muted),
    line(LEFT, 801, RIGHT, 801, color.teal, 1),
    line(LEFT, 42, RIGHT, 42),
    text("Educational Research Demonstration - Not Clinically Validated", LEFT, 25, 7.5, "F1", color.muted),
    text(`Case ${input.demoCase.number}  |  ${footerTitle}`, 300, 25, 7.5, "F1", color.muted),
    text(`Page ${pageNumber} of ${pageCount}`, 505, 25, 7.5, "F2", color.ink),
  ];
}

export function createCompetitionPdf(input: CompetitionReportInput): Uint8Array {
  const layout = new Layout(); addOpening(layout, input);
  layout.heading("Relevant Clinical History"); layout.paragraph(input.demoCase.id === "case-02" ? caseTwoHistory(input.history) : input.demoCase.clinicalSummary);
  if (input.demoCase.id === "case-02") { layout.heading("Data Provenance"); layout.paragraph("Clinical media were read from a browser-local object URL, optionally restored from consented on-device IndexedDB storage, and embedded client-side. Curated educational references remain distinct from clinician-confirmed observations. No automated analysis of arbitrary uploads or clinically validated performance is claimed.", { size: 8.8, color: color.muted }); }
  const modalities = modalitiesFor(input);
  for (const modality of modalities) addModality(layout, input, modality);
  if (input.kind === "fusion" || input.kind === "complete") addFusion(layout, input);
  if (input.demoCase.id !== "case-02") { layout.heading("Data Provenance"); layout.paragraph("Clinical media were read from browser-local object URLs, optionally restored from explicitly consented on-device IndexedDB storage, and embedded client-side. Preset educational references remain distinct from clinician-confirmed observations. No automated analysis of arbitrary uploads or clinically validated performance is claimed.", { size: 8.8, color: color.muted }); }
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
