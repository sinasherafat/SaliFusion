import { mediaSlotsForCase } from "@/data/demo-media";
import type { ReportMedia } from "@/lib/report/competition-pdf";
import type { CaseSession, ClinicalModality, CompetitionCase, GlandExam, PhaseAsset, UploadedAsset } from "@/types/competition";

const phaseOrder = ["precontrast", "ductal", "acinar", "evacuation"] as const;
const phaseLabel = { precontrast: "Scout / Precontrast", ductal: "Ductal Filling", acinar: "Acinar / Parenchymal Filling", evacuation: "Evacuation" };

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error(`Unable to load ${url}`)); image.src = url;
  });
}

function canvasJpeg(canvas: HTMLCanvasElement, label: string) {
  return new Promise<ReportMedia>((resolve, reject) => canvas.toBlob(async (blob) => {
    if (!blob) { reject(new Error(`Unable to encode ${label}`)); return; }
    resolve({ label, bytes: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height });
  }, "image/jpeg", .92));
}

async function imageToJpeg(asset: PhaseAsset | UploadedAsset, label: string) {
  const image = await loadImage(asset.url); const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight; canvas.getContext("2d")?.drawImage(image, 0, 0); return canvasJpeg(canvas, label);
}

async function videoToJpeg(asset: UploadedAsset, label: string) {
  const video = document.createElement("video"); video.muted = true; video.playsInline = true; video.preload = "auto"; video.src = asset.url;
  await new Promise<void>((resolve, reject) => { video.onloadedmetadata = () => resolve(); video.onerror = () => reject(new Error(`Unable to load ${asset.url}`)); video.load(); });
  const time = Number.isFinite(video.duration) ? Math.min(Math.max(video.duration / 2, 0), Math.max(video.duration - .05, 0)) : 0;
  if (time > 0) await new Promise<void>((resolve) => { video.onseeked = () => resolve(); video.currentTime = time; });
  const canvas = document.createElement("canvas"); canvas.width = video.videoWidth; canvas.height = video.videoHeight; canvas.getContext("2d")?.drawImage(video, 0, 0); const media = await canvasJpeg(canvas, label); video.removeAttribute("src"); video.load(); return media;
}

export async function collectReportMedia({ kind, demoCase, session, exam, includedModalities }: { kind: ClinicalModality | "fusion" | "complete"; demoCase: CompetitionCase; session: CaseSession; exam: GlandExam; includedModalities: ClinicalModality[] }) {
  const warnings: string[] = []; const captures: { label: string; run: () => Promise<ReportMedia> }[] = [];
  const includeUltrasound = kind === "ultrasound" || ((kind === "fusion" || kind === "complete") && includedModalities.includes("ultrasound"));
  const includeSialography = kind === "sialography" || ((kind === "fusion" || kind === "complete") && includedModalities.includes("sialography"));
  if (includeUltrasound) {
    const slots = mediaSlotsForCase(demoCase.id); const slot = slots.find((item) => item.id === session.selectedMediaSlot) ?? slots[0]; const uploaded = exam.ultrasoundUploads[slot.id];
    const asset: UploadedAsset | undefined = uploaded ?? (slot.mediaUrl ? { id: slot.id, name: slot.id, url: slot.mediaUrl, kind: "video", objectUrl: false } : undefined);
    const label = demoCase.id === "case-01" ? "Left Submandibular Gland - B-mode Ultrasound" : slot.label;
    if (asset) captures.push({ label: "ultrasound", run: () => asset.kind === "video" ? videoToJpeg(asset, label) : imageToJpeg(asset, label) });
  }
  if (includeSialography) for (const phase of phaseOrder) { const asset = exam.phaseUploads[phase]; if (asset) captures.push({ label: phase, run: () => imageToJpeg(asset, phaseLabel[phase]) }); }
  const results = await Promise.all(captures.map(async (capture) => { try { return await capture.run(); } catch (error) { warnings.push(error instanceof Error ? error.message : `Unable to load ${capture.label}`); return undefined; } }));
  const media = results.filter((item): item is ReportMedia => Boolean(item));
  return { media, warnings };
}
