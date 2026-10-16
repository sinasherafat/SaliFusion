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

async function waitForDecodedVideoFrame(video: HTMLVideoElement) {
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      video.pause();
      resolve();
    };
    const timeout = window.setTimeout(finish, 1500);
    const frameVideo = video as HTMLVideoElement & { requestVideoFrameCallback?: (callback: VideoFrameRequestCallback) => number };
    if (frameVideo.requestVideoFrameCallback) frameVideo.requestVideoFrameCallback(() => finish());
    else video.addEventListener("canplay", finish, { once: true });
    void video.play().catch(finish);
  });
}

async function videoFrameCanvas(asset: UploadedAsset) {
  const video = document.createElement("video"); video.muted = true; video.playsInline = true; video.preload = "auto"; video.src = asset.url;
  await new Promise<void>((resolve, reject) => { video.onloadedmetadata = () => resolve(); video.onerror = () => reject(new Error(`Unable to load ${asset.url}`)); video.load(); });
  const time = Number.isFinite(video.duration) ? Math.min(Math.max(video.duration / 2, 0), Math.max(video.duration - .05, 0)) : 0;
  if (time > 0) await new Promise<void>((resolve) => { video.onseeked = () => resolve(); video.currentTime = time; });
  await waitForDecodedVideoFrame(video);
  const canvas = document.createElement("canvas"); canvas.width = video.videoWidth; canvas.height = video.videoHeight; canvas.getContext("2d")?.drawImage(video, 0, 0); video.removeAttribute("src"); video.load(); return canvas;
}

async function videoToJpeg(asset: UploadedAsset, label: string) { return canvasJpeg(await videoFrameCanvas(asset), label); }

async function caseTwoVideoViews(asset: UploadedAsset) {
  const source = await videoFrameCanvas(asset); const width = Math.floor(source.width / 2); const height = Math.floor(source.height / 2);
  const views: { label: string; x: number; y: number; width: number; height: number }[] = [
    { label: "Original Full Four-Panel Composite", x: 0, y: 0, width: source.width, height: source.height },
    { label: "Right Parotid - B-mode (Upper-left source quadrant)", x: 0, y: 0, width, height },
    { label: "Left Parotid - B-mode (Lower-left source quadrant)", x: 0, y: height, width, height },
    { label: "Right Parotid - Doppler Imaging (Upper-right source quadrant)", x: width, y: 0, width, height },
    { label: "Left Parotid - Doppler Imaging (Lower-right source quadrant)", x: width, y: height, width, height },
  ];
  return Promise.all(views.map(({ label, x, y, width: cropWidth, height: cropHeight }) => { const canvas = document.createElement("canvas"); canvas.width = cropWidth; canvas.height = cropHeight; canvas.getContext("2d")?.drawImage(source, x, y, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight); return canvasJpeg(canvas, label); }));
}

export async function collectReportMedia({ kind, demoCase, session, exam, includedModalities }: { kind: ClinicalModality | "fusion" | "complete"; demoCase: CompetitionCase; session: CaseSession; exam: GlandExam; includedModalities: ClinicalModality[] }) {
  const warnings: string[] = []; const captures: { label: string; run: () => Promise<ReportMedia> }[] = [];
  const includeUltrasound = kind === "ultrasound" || ((kind === "fusion" || kind === "complete") && includedModalities.includes("ultrasound"));
  const includeSialography = kind === "sialography" || ((kind === "fusion" || kind === "complete") && includedModalities.includes("sialography"));
  if (demoCase.id === "case-02" && includeUltrasound) {
    const asset = exam.ultrasoundUploads["case-02-bilateral-parotid-composite-ultrasound"];
    if (!asset) return { media: [], warnings: ["Case 2 composite ultrasound video is not available in this browser session."] };
    try { return { media: await caseTwoVideoViews(asset), warnings }; } catch (error) { return { media: [], warnings: [error instanceof Error ? error.message : "Unable to capture Case 2 composite ultrasound views"] }; }
  }
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
