const databaseName = "salifusion-private-media-v1";
const storeName = "media";
const caseTwoVideoKey = "case-02-composite-ultrasound";
const consentPrefix = "salifusion-private-media-consent:";

export type PrivateMediaCaseId = "case-01" | "case-02";

export type StoredPrivateMedia = {
  id: string;
  caseId: PrivateMediaCaseId;
  slot: string;
  blob: Blob;
  name: string;
  type: string;
  lastModified: number;
  savedAt: number;
};

export type StoredPrivateVideo = StoredPrivateMedia & {
  id: typeof caseTwoVideoKey;
  caseId: "case-02";
  slot: typeof caseTwoVideoKey;
};

export const PRIVATE_MEDIA_CHANGED_EVENT = "salifusion-private-media-changed";

export function supportsPrivateMediaStorage() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

export function hasPrivateMediaConsent(caseId: PrivateMediaCaseId) {
  try { return globalThis.localStorage?.getItem(`${consentPrefix}${caseId}`) === "true"; } catch { return false; }
}

export function setPrivateMediaConsent(caseId: PrivateMediaCaseId, consented: boolean) {
  try {
    if (consented) globalThis.localStorage?.setItem(`${consentPrefix}${caseId}`, "true");
    else globalThis.localStorage?.removeItem(`${consentPrefix}${caseId}`);
  } catch { /* Consent state remains session-only when localStorage is unavailable. */ }
}

function recordId(caseId: PrivateMediaCaseId, slot: string) {
  return caseId === "case-02" && slot === caseTwoVideoKey ? caseTwoVideoKey : `${caseId}:${slot}`;
}

function notify(caseId: PrivateMediaCaseId) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(PRIVATE_MEDIA_CHANGED_EVENT, { detail: { caseId } }));
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!supportsPrivateMediaStorage()) {
      reject(new Error("Browser-local IndexedDB storage is unavailable."));
      return;
    }
    const request = window.indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open browser-local private media storage."));
  });
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Browser-local storage request failed."));
  });
}

function normalizeRecord(value: StoredPrivateMedia | (Omit<StoredPrivateVideo, "caseId" | "slot"> & { caseId?: undefined; slot?: undefined })): StoredPrivateMedia {
  if (value.caseId && value.slot) return value as StoredPrivateMedia;
  return { ...value, caseId: "case-02", slot: caseTwoVideoKey } as StoredPrivateMedia;
}

export async function loadStoredCaseMedia(caseId: PrivateMediaCaseId) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(storeName, "readonly");
    const values = await requestResult(transaction.objectStore(storeName).getAll()) as StoredPrivateMedia[];
    return values.map(normalizeRecord).filter((value) => value.caseId === caseId).sort((a, b) => a.savedAt - b.savedAt);
  } finally {
    database.close();
  }
}

export async function storePrivateMedia(caseId: PrivateMediaCaseId, slot: string, source: Blob, metadata: { name: string; type?: string; lastModified?: number }) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(storeName, "readwrite");
    await requestResult(transaction.objectStore(storeName).put({
      id: recordId(caseId, slot),
      caseId,
      slot,
      blob: source,
      name: metadata.name,
      type: metadata.type || source.type || "application/octet-stream",
      lastModified: metadata.lastModified ?? Date.now(),
      savedAt: Date.now(),
    } satisfies StoredPrivateMedia));
  } finally {
    database.close();
  }
  notify(caseId);
}

export async function removeStoredPrivateMedia(caseId: PrivateMediaCaseId, slot: string) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(storeName, "readwrite");
    await requestResult(transaction.objectStore(storeName).delete(recordId(caseId, slot)));
  } finally {
    database.close();
  }
  notify(caseId);
}

export async function clearStoredCaseMedia(caseId: PrivateMediaCaseId) {
  const records = await loadStoredCaseMedia(caseId);
  const database = await openDatabase();
  try {
    const transaction = database.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    await Promise.all(records.map((record) => requestResult(store.delete(record.id))));
  } finally {
    database.close();
  }
  setPrivateMediaConsent(caseId, false);
  notify(caseId);
}

export async function loadStoredCaseTwoVideo() {
  const records = await loadStoredCaseMedia("case-02");
  return records.find((record) => record.slot === caseTwoVideoKey) as StoredPrivateVideo | undefined;
}

export async function storeCaseTwoVideo(file: File | Blob, metadata?: { name: string; type?: string; lastModified?: number }) {
  const source = metadata ?? { name: file instanceof File ? file.name : "case-02-composite-video", type: file.type, lastModified: file instanceof File ? file.lastModified : Date.now() };
  await storePrivateMedia("case-02", caseTwoVideoKey, file, source);
}

export async function removeStoredCaseTwoVideo() {
  await removeStoredPrivateMedia("case-02", caseTwoVideoKey);
}

export async function clearPrivateMediaStorage() {
  await clearStoredCaseMedia("case-02");
}
