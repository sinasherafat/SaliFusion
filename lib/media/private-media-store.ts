const databaseName = "salifusion-private-media-v1";
const storeName = "media";
const caseTwoVideoKey = "case-02-composite-ultrasound";

export type StoredPrivateVideo = {
  id: typeof caseTwoVideoKey;
  blob: Blob;
  name: string;
  type: string;
  lastModified: number;
  savedAt: number;
};

export function supportsPrivateMediaStorage() {
  return typeof window !== "undefined" && "indexedDB" in window;
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

export async function loadStoredCaseTwoVideo() {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(storeName, "readonly");
    return (await requestResult(transaction.objectStore(storeName).get(caseTwoVideoKey))) as StoredPrivateVideo | undefined;
  } finally {
    database.close();
  }
}

export async function storeCaseTwoVideo(file: File) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(storeName, "readwrite");
    await requestResult(transaction.objectStore(storeName).put({
      id: caseTwoVideoKey,
      blob: file,
      name: file.name,
      type: file.type,
      lastModified: file.lastModified,
      savedAt: Date.now(),
    } satisfies StoredPrivateVideo));
  } finally {
    database.close();
  }
}

export async function removeStoredCaseTwoVideo() {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(storeName, "readwrite");
    await requestResult(transaction.objectStore(storeName).delete(caseTwoVideoKey));
  } finally {
    database.close();
  }
}

export async function clearPrivateMediaStorage() {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(storeName, "readwrite");
    await requestResult(transaction.objectStore(storeName).clear());
  } finally {
    database.close();
  }
}
