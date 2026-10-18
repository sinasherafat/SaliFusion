import type { PrivateMediaCaseId } from "@/lib/media/private-media-store";

const magic = "SALIFUSION_PRIVATE_MEDIA_BUNDLE_V1\n";
const headerLengthWidth = 12;

export type PrivateMediaBundleItem = {
  slot: string;
  blob: Blob;
  name: string;
  type: string;
  lastModified: number;
};

type BundleManifest = {
  format: "salifusion-private-media";
  version: 1;
  caseId: PrivateMediaCaseId;
  createdAt: string;
  files: Array<Omit<PrivateMediaBundleItem, "blob"> & { size: number; offset: number }>;
};

export function createPrivateMediaBundle(caseId: PrivateMediaCaseId, items: PrivateMediaBundleItem[]) {
  if (!items.length) throw new Error("No browser-local media are available to export.");
  let offset = 0;
  const files = items.map(({ slot, blob, name, type, lastModified }) => {
    const entry = { slot, name, type: type || blob.type || "application/octet-stream", lastModified, size: blob.size, offset };
    offset += blob.size;
    return entry;
  });
  const manifest: BundleManifest = { format: "salifusion-private-media", version: 1, caseId, createdAt: new Date().toISOString(), files };
  const header = new TextEncoder().encode(JSON.stringify(manifest));
  const prefix = new TextEncoder().encode(`${magic}${String(header.length).padStart(headerLengthWidth, "0")}\n`);
  return new Blob([prefix, header, ...items.map((item) => item.blob)], { type: "application/vnd.salifusion.private-media" });
}

export async function parsePrivateMediaBundle(file: Blob, expectedCaseId: PrivateMediaCaseId, allowedSlots: readonly string[]) {
  const prefixLength = new TextEncoder().encode(magic).length + headerLengthWidth + 1;
  const prefix = await file.slice(0, prefixLength).text();
  if (!prefix.startsWith(magic)) throw new Error("This is not a SaliFusion private media bundle.");
  const headerLength = Number(prefix.slice(magic.length, magic.length + headerLengthWidth));
  if (!Number.isSafeInteger(headerLength) || headerLength <= 0 || headerLength > 1_000_000) throw new Error("The private media bundle header is invalid.");
  const headerStart = prefixLength;
  const payloadStart = headerStart + headerLength;
  if (payloadStart > file.size) throw new Error("The private media bundle is truncated.");
  const manifest = JSON.parse(await file.slice(headerStart, payloadStart).text()) as BundleManifest;
  if (manifest.format !== "salifusion-private-media" || manifest.version !== 1) throw new Error("The private media bundle version is unsupported.");
  if (manifest.caseId !== expectedCaseId) throw new Error(`This bundle belongs to ${manifest.caseId}, not ${expectedCaseId}.`);
  const allowed = new Set(allowedSlots);
  const seen = new Set<string>();
  const items: PrivateMediaBundleItem[] = [];
  for (const entry of manifest.files) {
    if (!allowed.has(entry.slot) || seen.has(entry.slot)) throw new Error("The private media bundle contains an unexpected or duplicate slot.");
    if (!Number.isSafeInteger(entry.offset) || !Number.isSafeInteger(entry.size) || entry.offset < 0 || entry.size < 0 || payloadStart + entry.offset + entry.size > file.size) throw new Error("The private media bundle contains an invalid file range.");
    seen.add(entry.slot);
    items.push({ slot: entry.slot, name: entry.name, type: entry.type, lastModified: entry.lastModified, blob: file.slice(payloadStart + entry.offset, payloadStart + entry.offset + entry.size, entry.type) });
  }
  if (!items.length) throw new Error("The private media bundle does not contain any files.");
  return items;
}

export function downloadPrivateMediaBundle(caseId: PrivateMediaCaseId, bundle: Blob) {
  const url = URL.createObjectURL(bundle);
  const link = document.createElement("a");
  link.href = url;
  link.download = `SaliFusion_${caseId.replace("-", "_")}_Private_Media.salifusion-media`;
  link.click();
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
