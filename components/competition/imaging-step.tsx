"use client";

import Image from "next/image";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { builtInMediaForCase, mediaSlotsForCase } from "@/data/demo-media";
import { getDuctalRecommendation } from "@/lib/clinical/competition-rules";
import { groupDicomSeries } from "@/lib/dicom/parse-dicom";
import { createPrivateMediaBundle, downloadPrivateMediaBundle, parsePrivateMediaBundle, type PrivateMediaBundleItem } from "@/lib/media/private-media-bundle";
import { clearStoredCaseMedia, hasPrivateMediaConsent, loadStoredCaseMedia, loadStoredCaseTwoVideo, PRIVATE_MEDIA_CHANGED_EVENT, removeStoredCaseTwoVideo, removeStoredPrivateMedia, setPrivateMediaConsent, storeCaseTwoVideo, storePrivateMedia, supportsPrivateMediaStorage, type StoredPrivateMedia } from "@/lib/media/private-media-store";
import type { CaseSession, CompetitionCase, GlandExam, PhaseAsset, SialographyPhase, SialographyPhaseFixture, UploadedAsset } from "@/types/competition";

const MprViewer = lazy(() => import("@/components/viewers/cornerstone-mpr-viewer").then((module) => ({ default: module.CornerstoneMprViewer })));
const ImageViewer = lazy(() => import("@/components/viewers/fallback-image-viewer").then((module) => ({ default: module.FallbackImageViewer })));

const phaseLabels: Record<SialographyPhase, string> = { precontrast: "Precontrast", ductal: "Ductal filling", acinar: "Acinar / parenchymal filling", evacuation: "Evacuation" };
const phases = Object.keys(phaseLabels) as SialographyPhase[];
const caseOneUltrasoundId = "case-01-left-submandibular-bmode";
const caseOnePhaseSlots: Record<SialographyPhase, string> = { precontrast: "case-01-precontrast", ductal: "case-01-ductal", acinar: "case-01-acinar", evacuation: "case-01-evacuation" };
const caseOneSlotPhases = Object.fromEntries(Object.entries(caseOnePhaseSlots).map(([phase, slot]) => [slot, phase])) as Record<string, SialographyPhase>;
const caseOneAllowedSlots = [caseOneUltrasoundId, ...Object.values(caseOnePhaseSlots)];

export function ImagingStep({ demoCase, session, exam, onSession, onExam, onAddExam, onRemoveExam }: {
  demoCase: CompetitionCase; session: CaseSession; exam: GlandExam; onSession: (session: CaseSession) => void; onExam: (exam: GlandExam) => void; onAddExam: () => void; onRemoveExam: () => void;
}) {
  const recommendation = getDuctalRecommendation(demoCase.id, session.history);
  const modalities = [{ id: "ultrasound" as const, label: "Ultrasound" }, { id: "sialography" as const, label: "2D Sialography" }, { id: "cbct" as const, label: "3D CBCT Sialography" }];
  const updateSession = (patch: Partial<CaseSession>) => onSession({ ...session, ...patch });
  return <section className="step-page imaging-page" data-testid="imaging-step">
    <header className="page-intro compact"><div><span className="section-kicker">Independent modality review</span><h1>Imaging workspace</h1><p>Choose one modality. Each viewer and report remains independently usable.</p></div><span className="local-badge">Local browser session · no upload to server</span></header>
    {demoCase.id === "case-01" && <CaseOneLocalMediaLoader session={session} onSession={onSession} />}
    <div className="modality-tabs" role="tablist" aria-label="Imaging modality">{modalities.map((item) => <button key={item.id} role="tab" aria-selected={session.activeModality === item.id} className={session.activeModality === item.id ? "active" : recommendation.state === "defer" && item.id !== "ultrasound" ? "warning-tab" : ""} onClick={() => updateSession({ activeModality: item.id })}><span>{item.id === "ultrasound" ? "US" : item.id === "sialography" ? "2D" : "3D"}</span>{item.label}</button>)}</div>
    <GlandBar session={session} exam={exam} onSession={onSession} onExam={onExam} onAddExam={onAddExam} onRemoveExam={onRemoveExam} />
    {session.activeModality === "ultrasound" && <UltrasoundWorkspace demoCase={demoCase} session={session} exam={exam} onSession={onSession} onExam={onExam} />}
    {session.activeModality === "sialography" && <SialographyWorkspace demoCase={demoCase} exam={exam} recommendation={recommendation} onExam={onExam} />}
    {session.activeModality === "cbct" && <CbctWorkspace demoCase={demoCase} exam={exam} recommendation={recommendation} onExam={onExam} />}
  </section>;
}

function CaseOneLocalMediaLoader({ session, onSession }: { session: CaseSession; onSession: (session: CaseSession) => void }) {
  const ultrasoundSlot = mediaSlotsForCase("case-01")[0];
  const phaseInputs: { phase: SialographyPhase; label: string }[] = [
    { phase: "precontrast", label: "Scout / precontrast" },
    { phase: "ductal", label: "Ductal filling" },
    { phase: "acinar", label: "Acinar / parenchymal filling" },
    { phase: "evacuation", label: "Evacuation" },
  ];
  const canonicalExam = session.exams[0];
  const [persistOnDevice, setPersistOnDevice] = useState(() => supportsPrivateMediaStorage() && hasPrivateMediaConsent("case-01"));
  const [storedCount, setStoredCount] = useState(0);
  const [storageState, setStorageState] = useState<"checking" | "session" | "stored" | "unavailable" | "error">(() => supportsPrivateMediaStorage() ? "checking" : "unavailable");
  const [transferMessage, setTransferMessage] = useState("");
  const sessionRef = useRef(session);
  useEffect(() => { sessionRef.current = session; }, [session]);

  function attachItems(items: PrivateMediaBundleItem[] | StoredPrivateMedia[], storage: "session" | "device") {
    const current = sessionRef.current;
    const primary = current.exams[0];
    const ultrasoundUploads = { ...primary.ultrasoundUploads };
    const phaseUploads = { ...primary.phaseUploads };
    for (const item of items) {
      if (item.slot === caseOneUltrasoundId) {
        const old = ultrasoundUploads[caseOneUltrasoundId]; if (old?.objectUrl) URL.revokeObjectURL(old.url);
        ultrasoundUploads[caseOneUltrasoundId] = { id: caseOneUltrasoundId, name: item.name, url: URL.createObjectURL(item.blob), kind: "video", objectUrl: true, storage, type: item.type, lastModified: item.lastModified };
      } else {
        const phase = caseOneSlotPhases[item.slot]; if (!phase) continue;
        const old = phaseUploads[phase]; if (old?.objectUrl) URL.revokeObjectURL(old.url);
        phaseUploads[phase] = { name: item.name, url: URL.createObjectURL(item.blob), objectUrl: true, storage, type: item.type, lastModified: item.lastModified };
      }
    }
    const nextExam: GlandExam = { ...primary, gland: "submandibular", side: "left", ultrasoundUploads, phaseUploads, reviewed: { ...primary.reviewed, ultrasound: false, sialography: false }, clinicianVerified: { ...primary.clinicianVerified, ultrasound: false, sialography: false } };
    onSession({ ...current, activeExamId: primary.id, selectedMediaSlot: caseOneUltrasoundId, exams: current.exams.map((item) => item.id === primary.id ? nextExam : item), fusionGenerated: false, fusionReviewed: false, fusionImpression: "" });
    setStorageState(storage === "device" ? "stored" : "session");
  }

  async function refreshStoredCount() {
    if (!supportsPrivateMediaStorage()) return;
    try {
      const stored = await loadStoredCaseMedia("case-01");
      setStoredCount(stored.length);
      setStorageState(stored.length ? "stored" : "session");
    } catch { setStorageState("error"); }
  }

  useEffect(() => {
    let cancelled = false;
    if (!supportsPrivateMediaStorage()) return;
    void loadStoredCaseMedia("case-01").then((stored) => {
      if (cancelled) return;
      setStoredCount(stored.length);
      const activeExam = sessionRef.current.exams[0];
      const hasReplacement = Object.values(activeExam.ultrasoundUploads).some((asset) => Boolean(asset && asset.storage !== "built-in")) || Object.values(activeExam.phaseUploads).some((asset) => Boolean(asset && asset.storage !== "built-in"));
      if (stored.length && !hasReplacement) {
        setPersistOnDevice(true); setPrivateMediaConsent("case-01", true); attachItems(stored, "device");
      } else setStorageState(stored.length ? "stored" : "session");
    }).catch(() => { if (!cancelled) setStorageState("error"); });
    const changed = (event: Event) => { if ((event as CustomEvent<{ caseId: string }>).detail?.caseId === "case-01") void refreshStoredCount(); };
    window.addEventListener(PRIVATE_MEDIA_CHANGED_EVENT, changed);
    return () => { cancelled = true; window.removeEventListener(PRIVATE_MEDIA_CHANGED_EVENT, changed); };
    // Restoration is intentionally attempted once when the Case 1 imaging workspace mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function currentBundleItems() {
    const current = sessionRef.current.exams[0];
    const assets: Array<{ slot: string; asset: UploadedAsset | PhaseAsset }> = [];
    const ultrasound = current.ultrasoundUploads[caseOneUltrasoundId]; if (ultrasound && ultrasound.storage !== "built-in") assets.push({ slot: caseOneUltrasoundId, asset: ultrasound });
    for (const phase of phases) { const asset = current.phaseUploads[phase]; if (asset && asset.storage !== "built-in") assets.push({ slot: caseOnePhaseSlots[phase], asset }); }
    return Promise.all(assets.map(async ({ slot, asset }) => {
      const blob = await (await fetch(asset.url)).blob();
      return { slot, blob, name: asset.name, type: asset.type || blob.type || "application/octet-stream", lastModified: asset.lastModified ?? Date.now() } satisfies PrivateMediaBundleItem;
    }));
  }

  async function setPersistence(consented: boolean) {
    setPersistOnDevice(consented); setPrivateMediaConsent("case-01", consented);
    if (!consented || !supportsPrivateMediaStorage()) return;
    try {
      const items = await currentBundleItems();
      await Promise.all(items.map((item) => storePrivateMedia("case-01", item.slot, item.blob, item)));
      if (items.length) { attachItems(items, "device"); setTransferMessage("Current Case 1 media stored locally on this device."); }
      else setStorageState("session");
    } catch { setStorageState("error"); }
  }

  async function loadItem(slot: string, file?: File) {
    if (!file) return;
    const item: PrivateMediaBundleItem = { slot, blob: file, name: file.name, type: file.type || "application/octet-stream", lastModified: file.lastModified };
    let storage: "session" | "device" = "session";
    if (persistOnDevice && supportsPrivateMediaStorage()) {
      try { await storePrivateMedia("case-01", slot, file, item); storage = "device"; } catch { setStorageState("error"); }
    }
    attachItems([item], storage);
  }

  async function removeItem(slot: string) {
    const current = sessionRef.current; const primary = current.exams[0]; const ultrasoundUploads = { ...primary.ultrasoundUploads }; const phaseUploads = { ...primary.phaseUploads };
    const builtIn = builtInMediaForCase("case-01");
    if (slot === caseOneUltrasoundId) { const old = ultrasoundUploads[slot]; if (old?.objectUrl) URL.revokeObjectURL(old.url); ultrasoundUploads[slot] = builtIn.ultrasoundUploads[slot]; }
    else { const phase = caseOneSlotPhases[slot]; const old = phaseUploads[phase]; if (old?.objectUrl) URL.revokeObjectURL(old.url); phaseUploads[phase] = builtIn.phaseUploads[phase]; }
    if (supportsPrivateMediaStorage()) { try { await removeStoredPrivateMedia("case-01", slot); } catch { setStorageState("error"); } }
    const nextExam = { ...primary, ultrasoundUploads, phaseUploads, reviewed: { ...primary.reviewed, ultrasound: false, sialography: false }, clinicianVerified: { ...primary.clinicianVerified, ultrasound: false, sialography: false } };
    onSession({ ...current, exams: current.exams.map((item) => item.id === primary.id ? nextExam : item), fusionGenerated: false, fusionReviewed: false, fusionImpression: "" });
  }

  async function clearCaseMedia() {
    if (!window.confirm("Clear Case 1 replacement files and restore all five built-in clinical demo assets?")) return;
    const current = sessionRef.current; const primary = current.exams[0];
    Object.values(primary.ultrasoundUploads).forEach((asset) => { if (asset?.objectUrl) URL.revokeObjectURL(asset.url); });
    Object.values(primary.phaseUploads).forEach((asset) => { if (asset?.objectUrl) URL.revokeObjectURL(asset.url); });
    if (supportsPrivateMediaStorage()) { try { await clearStoredCaseMedia("case-01"); } catch { setStorageState("error"); return; } }
    setPersistOnDevice(false); setStoredCount(0); setTransferMessage("");
    const builtIn = builtInMediaForCase("case-01");
    const nextExam = { ...primary, ultrasoundUploads: builtIn.ultrasoundUploads, phaseUploads: builtIn.phaseUploads, reviewed: { ...primary.reviewed, ultrasound: false, sialography: false }, clinicianVerified: { ...primary.clinicianVerified, ultrasound: false, sialography: false } };
    onSession({ ...current, exams: current.exams.map((item) => item.id === primary.id ? nextExam : item), fusionGenerated: false, fusionReviewed: false, fusionImpression: "" });
    setStorageState(supportsPrivateMediaStorage() ? "session" : "unavailable");
  }

  async function exportBundle() {
    try { const items = await currentBundleItems(); downloadPrivateMediaBundle("case-01", createPrivateMediaBundle("case-01", items)); setTransferMessage(`Exported ${items.length} original Case 1 file${items.length === 1 ? "" : "s"} in a local-only bundle.`); }
    catch (error) { setTransferMessage(error instanceof Error ? error.message : "Unable to export the private media bundle."); }
  }

  async function importBundle(file?: File) {
    if (!file) return;
    try {
      const items = await parsePrivateMediaBundle(file, "case-01", caseOneAllowedSlots);
      let storage: "session" | "device" = "session";
      if (persistOnDevice && supportsPrivateMediaStorage()) { await Promise.all(items.map((item) => storePrivateMedia("case-01", item.slot, item.blob, item))); storage = "device"; }
      attachItems(items, storage); setTransferMessage(`Imported ${items.length} Case 1 file${items.length === 1 ? "" : "s"} locally. No network transfer occurred.`);
    } catch (error) { setTransferMessage(error instanceof Error ? error.message : "Unable to import the private media bundle."); }
  }

  const replacementCount = Number(Boolean(canonicalExam.ultrasoundUploads[caseOneUltrasoundId] && canonicalExam.ultrasoundUploads[caseOneUltrasoundId]?.storage !== "built-in")) + phases.filter((phase) => Boolean(canonicalExam.phaseUploads[phase] && canonicalExam.phaseUploads[phase]?.storage !== "built-in")).length;
  const persistenceMessage = storageState === "stored" ? `${storedCount}/5 replacement files stored only in this browser origin.` : storageState === "unavailable" ? "IndexedDB is unavailable; replacements remain session-only." : storageState === "error" ? "Browser-local persistence was unavailable or denied; replacements remain session-only." : "Optional replacements remain session-only unless device persistence is selected.";
  return <section className="case-one-local-loader" aria-label="Case 1 built-in and browser-local media">
    <header><div><span>Built-in Clinical Demo Media</span><h2>Case 1 media are ready</h2></div><p>The owner-authorized, de-identified ultrasound and four ordered sialography phases load from this protected Preview. Optional replacements are processed only in this browser and are never submitted to a server, remote API, cloud storage, or analytics service.</p></header>
    <div className="local-loader-grid">
      <div className={`case-one-media-slot ${canonicalExam.ultrasoundUploads[ultrasoundSlot.id] ? "loaded" : ""}`}><label><span>01 · Ultrasound</span><strong>{canonicalExam.ultrasoundUploads[ultrasoundSlot.id]?.name || "Choose the B-mode MOV"}</strong><input type="file" accept="video/*,.mov" aria-label="Load Case 1 ultrasound video" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void loadItem(caseOneUltrasoundId, file); }} /></label>{canonicalExam.ultrasoundUploads[ultrasoundSlot.id]?.storage !== "built-in" && <button onClick={() => void removeItem(caseOneUltrasoundId)}>Restore built-in</button>}</div>
      {phaseInputs.map(({ phase, label }, index) => <div className={`case-one-media-slot ${canonicalExam.phaseUploads[phase] ? "loaded" : ""}`} key={phase}><label><span>0{index + 2} · {label}</span><strong>{canonicalExam.phaseUploads[phase]?.name || "Choose the matching image"}</strong><input type="file" accept="image/*" aria-label={`Load Case 1 ${label}`} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void loadItem(caseOnePhaseSlots[phase], file); }} /></label>{canonicalExam.phaseUploads[phase]?.storage !== "built-in" && <button onClick={() => void removeItem(caseOnePhaseSlots[phase])}>Restore built-in</button>}</div>)}
    </div>
    <div className="private-media-toolbar"><label className="case-two-persistence-consent"><input type="checkbox" aria-label="Remember all Case 1 media on this device" checked={persistOnDevice} disabled={!supportsPrivateMediaStorage()} onChange={(event) => void setPersistence(event.target.checked)} />Remember Case 1 replacements on this device</label><button onClick={() => void exportBundle()} disabled={!replacementCount}>Export Private Case Media</button><label className="private-media-import">Import Private Case Media<input hidden type="file" accept=".salifusion-media,application/vnd.salifusion.private-media" aria-label="Import Case 1 private media bundle" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void importBundle(file); }} /></label><button className="danger" onClick={() => void clearCaseMedia()} disabled={!replacementCount && !storedCount}>Restore Built-in Media</button></div>
    <div className={`case-one-storage-status ${storageState}`} role="status"><b>Built-in Clinical Demo Media · {canonicalExam.ultrasoundUploads[caseOneUltrasoundId] ? "Ultrasound ready" : "Ultrasound pending"} · {phases.filter((phase) => canonicalExam.phaseUploads[phase]).length}/4 sialography phases ready</b><span>{persistenceMessage} The five built-in assets return whenever this demonstration is reset.</span>{transferMessage && <small>{transferMessage}</small>}</div>
  </section>;
}

function GlandBar({ session, exam, onSession, onExam, onAddExam, onRemoveExam }: { session: CaseSession; exam: GlandExam; onSession: (session: CaseSession) => void; onExam: (exam: GlandExam) => void; onAddExam: () => void; onRemoveExam: () => void }) {
  const index = session.exams.findIndex((item) => item.id === exam.id);
  return <div className="gland-bar"><div className="gland-fields"><label>Gland<select aria-label="Examination gland" value={exam.gland} onChange={(event) => onExam({ ...exam, gland: event.target.value as GlandExam["gland"] })}><option value="parotid">Parotid</option><option value="submandibular">Submandibular</option><option value="sublingual">Sublingual</option><option value="other">Other</option></select></label><label>Side<select aria-label="Examination side" value={exam.side} onChange={(event) => onExam({ ...exam, side: event.target.value as GlandExam["side"] })}><option value="left">Left</option><option value="right">Right</option></select></label><label>Examination<strong>{session.activeModality === "ultrasound" ? "Ultrasound" : session.activeModality === "sialography" ? "2D Sialography" : "CBCT / 3D"}</strong></label></div><div className="exam-actions"><button onClick={onAddExam}>+ Add another gland</button><select aria-label="Switch gland examination" value={exam.id} onChange={(event) => onSession({ ...session, activeExamId: event.target.value })}>{session.exams.map((item, itemIndex) => <option key={item.id} value={item.id}>{itemIndex + 1}. {item.side} {item.gland}</option>)}</select><button disabled={index === 0} onClick={() => onSession({ ...session, activeExamId: session.exams[index - 1].id })}>Previous gland</button><button className="remove" disabled={session.exams.length === 1} onClick={onRemoveExam}>Remove examination</button></div></div>;
}

function UltrasoundWorkspace({ demoCase, session, exam, onSession, onExam }: { demoCase: CompetitionCase; session: CaseSession; exam: GlandExam; onSession: (session: CaseSession) => void; onExam: (exam: GlandExam) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null); const [speed, setSpeed] = useState("1");
  if (demoCase.id === "case-02") return <CaseTwoUltrasoundWorkspace demoCase={demoCase} session={session} exam={exam} onSession={onSession} />;
  const slots = mediaSlotsForCase(demoCase.id); const selected = slots.find((item) => item.id === session.selectedMediaSlot) ?? slots[0];
  const uploaded = exam.ultrasoundUploads[selected.id];
  const mediaAsset: UploadedAsset | undefined = uploaded ?? (selected.mediaUrl ? { id: selected.id, name: selected.id, url: selected.mediaUrl, kind: "video", objectUrl: false } : undefined);
  async function importMedia(file: File | undefined, kind: UploadedAsset["kind"]) { if (!file) return; const old = exam.ultrasoundUploads[selected.id]; if (old?.objectUrl) URL.revokeObjectURL(old.url); let storage: UploadedAsset["storage"] = "session"; if (demoCase.id === "case-01" && hasPrivateMediaConsent("case-01") && supportsPrivateMediaStorage()) { try { await storePrivateMedia("case-01", selected.id, file, { name: file.name, type: file.type, lastModified: file.lastModified }); storage = "device"; } catch { storage = "session"; } } onExam({ ...exam, ultrasoundUploads: { ...exam.ultrasoundUploads, [selected.id]: { id: selected.id, name: file.name, url: URL.createObjectURL(file), kind, objectUrl: true, storage, type: file.type, lastModified: file.lastModified } }, reviewed: { ...exam.reviewed, ultrasound: false }, clinicianVerified: { ...exam.clinicianVerified, ultrasound: false } }); }
  function captureFrame() { const video = videoRef.current; if (!video?.videoWidth) return; const canvas = document.createElement("canvas"); canvas.width = video.videoWidth; canvas.height = video.videoHeight; canvas.getContext("2d")?.drawImage(video, 0, 0); const link = document.createElement("a"); link.href = canvas.toDataURL("image/png"); link.download = `${selected.id}-frame.png`; link.click(); }
  const mismatch = selected.gland !== exam.gland || selected.side !== exam.side;
  return <div className="modality-workspace"><div className="viewer-column"><div className="scan-header"><span><i /> Prerecorded Educational Ultrasound Replay</span><div>{selected.side} {selected.gland} · {selected.mode === "bmode" ? "B-mode" : "Doppler Imaging"}</div></div><div className="ultrasound-stage">
    <MediaPane asset={mediaAsset} slotLabel={selected.label} videoRef={videoRef} speed={Number(speed)} />
  </div><div className="playback-bar"><button onClick={() => videoRef.current?.paused ? void videoRef.current.play() : videoRef.current?.pause()} disabled={!mediaAsset || mediaAsset.kind !== "video"}>Play / Pause</button><button onClick={() => { if (videoRef.current) { videoRef.current.currentTime = 0; void videoRef.current.play(); } }} disabled={!mediaAsset || mediaAsset.kind !== "video"}>Replay</button><button onClick={captureFrame} disabled={!mediaAsset || mediaAsset.kind !== "video"}>Capture frame</button><button onClick={() => void videoRef.current?.requestFullscreen()} disabled={!mediaAsset}>Enlarge</button><label>Speed<select aria-label="Playback speed" value={speed} onChange={(event) => { setSpeed(event.target.value); if (videoRef.current) videoRef.current.playbackRate = Number(event.target.value); }}><option value="0.5">0.5×</option><option value="1">1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label></div>
    {mismatch && <div className="inline-warning amber">Media metadata does not match the active {exam.side} {exam.gland} examination. Confirm identity before reporting.</div>}
    <div className="slot-selector"><div><span>Demo clip</span><select aria-label="Select demo clip" value={selected.id} onChange={(event) => onSession({ ...session, selectedMediaSlot: event.target.value, comparisonMode: false })}>{slots.map((slot) => <option key={slot.id} value={slot.id}>{slot.label}</option>)}</select></div><label className="upload-button">Upload video<input aria-label="Upload ultrasound video" hidden type="file" accept="video/*,.mov" onChange={(event) => void importMedia(event.target.files?.[0], "video")} /></label><label className="upload-button secondary">Upload image<input aria-label="Upload ultrasound image" hidden type="file" accept="image/png,image/jpeg" onChange={(event) => void importMedia(event.target.files?.[0], "image")} /></label>{uploaded && <button className="text-button" onClick={() => { if (uploaded.objectUrl) URL.revokeObjectURL(uploaded.url); const next = { ...exam.ultrasoundUploads }; delete next[selected.id]; if (demoCase.id === "case-01" && supportsPrivateMediaStorage()) void removeStoredPrivateMedia("case-01", selected.id); onExam({ ...exam, ultrasoundUploads: next, reviewed: { ...exam.reviewed, ultrasound: false }, clinicianVerified: { ...exam.clinicianVerified, ultrasound: false } }); }}>Remove local file</button>}</div>
    <p className="media-note">Slot ID: <code>{selected.id}</code>. {mediaAsset?.storage === "built-in" ? "Built-in Clinical Demo Media is served from this protected Preview." : "Replacement media remain in browser memory and are not uploaded."} Original aspect ratio is preserved.</p>
  </div><AnalysisPanel title="Ultrasound educational analysis" demoCase={demoCase} modality="ultrasound" verified={Boolean(exam.clinicianVerified.ultrasound)} reviewed={Boolean(exam.reviewed.ultrasound)} onReview={() => onExam({ ...exam, reviewed: { ...exam.reviewed, ultrasound: true } })} onVerify={() => onExam({ ...exam, clinicianVerified: { ...exam.clinicianVerified, ultrasound: true }, reviewed: { ...exam.reviewed, ultrasound: true } })} />
  </div>;
}

type CaseTwoView = "full" | "right-bmode" | "left-bmode" | "right-doppler" | "left-doppler";
const caseTwoCompositeId = "case-02-bilateral-parotid-composite-ultrasound";
const caseTwoLegacyIds = ["case-02-left-parotid-bmode-abnormal", "case-02-right-parotid-bmode-normal", "case-02-left-parotid-doppler-abnormal", "case-02-right-parotid-doppler-normal"];
const caseTwoViews: { id: CaseTwoView; label: string; detail: string; region: "full" | "upper-left" | "upper-right" | "lower-left" | "lower-right" }[] = [
  { id: "full", label: "Full Comparison", detail: "Original four-panel source", region: "full" },
  { id: "right-bmode", label: "Right B-mode", detail: "Reference gland", region: "upper-left" },
  { id: "left-bmode", label: "Left B-mode", detail: "Symptomatic gland", region: "lower-left" },
  { id: "right-doppler", label: "Right Doppler", detail: "Reference Doppler Imaging", region: "upper-right" },
  { id: "left-doppler", label: "Left Doppler", detail: "Symptomatic Doppler Imaging", region: "lower-right" },
];

function CaseTwoUltrasoundWorkspace({ demoCase, session, exam, onSession }: { demoCase: CompetitionCase; session: CaseSession; exam: GlandExam; onSession: (session: CaseSession) => void }) {
  const canonicalExam = session.exams.find((item) => item.ultrasoundUploads[caseTwoCompositeId]) ?? session.exams.find((item) => item.reviewed.ultrasound) ?? exam;
  const asset = canonicalExam.ultrasoundUploads[caseTwoCompositeId];
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<CaseTwoView>("full");
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState("1");
  const [persistOnDevice, setPersistOnDevice] = useState(() => supportsPrivateMediaStorage() && hasPrivateMediaConsent("case-02"));
  const [storedVideoAvailable, setStoredVideoAvailable] = useState(false);
  const [storageState, setStorageState] = useState<"checking" | "session" | "stored" | "unavailable" | "error">(() => supportsPrivateMediaStorage() ? "checking" : "unavailable");
  const [transferMessage, setTransferMessage] = useState("");
  const sessionRef = useRef(session);
  useEffect(() => { sessionRef.current = session; }, [session]);
  const activeView = caseTwoViews.find((item) => item.id === view)!;

  useEffect(() => {
    let cancelled = false;
    if (!supportsPrivateMediaStorage()) return;
    void loadStoredCaseTwoVideo().then((stored) => {
      if (cancelled) return;
      setStoredVideoAvailable(Boolean(stored));
      setPersistOnDevice(Boolean(stored));
      const hasReplacement = sessionRef.current.exams.some((item) => Boolean(item.ultrasoundUploads[caseTwoCompositeId] && item.ultrasoundUploads[caseTwoCompositeId]?.storage !== "built-in"));
      if (stored && !hasReplacement) {
        setPrivateMediaConsent("case-02", true);
        attachComposite(stored.blob, stored.name, "device", stored);
      } else {
        setStorageState(stored ? "stored" : asset ? "session" : "session");
      }
    }).catch(() => { if (!cancelled) setStorageState("error"); });
    return () => { cancelled = true; };
    // Restoration is intentionally attempted once when the Case 2 workspace mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function attachComposite(blob: Blob, name: string, storage: UploadedAsset["storage"], metadata?: { type?: string; lastModified?: number }) {
    const current = sessionRef.current;
    const previous = current.exams.map((item) => item.ultrasoundUploads[caseTwoCompositeId]).find(Boolean);
    if (previous?.objectUrl) URL.revokeObjectURL(previous.url);
    const url = URL.createObjectURL(blob);
    const sharedAsset: UploadedAsset = { id: caseTwoCompositeId, name, url, kind: "video", objectUrl: true, storage, type: metadata?.type || blob.type, lastModified: metadata?.lastModified ?? Date.now() };
    const exams = current.exams.map((item) => {
      const ultrasoundUploads: GlandExam["ultrasoundUploads"] = { ...item.ultrasoundUploads, [caseTwoCompositeId]: sharedAsset };
      for (const id of caseTwoLegacyIds) ultrasoundUploads[id] = { ...sharedAsset, id };
      return { ...item, ultrasoundUploads, reviewed: { ...item.reviewed, ultrasound: false }, clinicianVerified: { ...item.clinicianVerified, ultrasound: false } };
    });
    onSession({ ...current, activeModality: "ultrasound", exams, fusionGenerated: false, fusionReviewed: false, fusionImpression: "" });
    setStorageState(storage === "device" ? "stored" : "session");
  }

  async function loadComposite(file?: File) {
    if (!file) return;
    let storage: UploadedAsset["storage"] = "session";
    if (persistOnDevice && supportsPrivateMediaStorage()) {
      try {
        await storeCaseTwoVideo(file);
        setStoredVideoAvailable(true);
        storage = "device";
      } catch {
        setStorageState("error");
      }
    }
    attachComposite(file, file.name, storage, { type: file.type, lastModified: file.lastModified });
  }

  function removeCompositeFromSession() {
    const current = sessionRef.current;
    const previous = current.exams.map((item) => item.ultrasoundUploads[caseTwoCompositeId]).find(Boolean);
    if (previous?.objectUrl) URL.revokeObjectURL(previous.url);
    const builtIn = builtInMediaForCase("case-02");
    const exams = current.exams.map((item) => ({ ...item, ultrasoundUploads: { ...item.ultrasoundUploads, ...builtIn.ultrasoundUploads }, reviewed: { ...item.reviewed, ultrasound: false }, clinicianVerified: { ...item.clinicianVerified, ultrasound: false } }));
    onSession({ ...current, exams, fusionGenerated: false, fusionReviewed: false, fusionImpression: "" });
    setStorageState(storedVideoAvailable ? "stored" : "session");
  }

  async function removeStoredVideo() {
    if (!storedVideoAvailable || !window.confirm("Remove the stored Case 2 video from this browser? The current session copy will remain available until cleared or refreshed.")) return;
    try {
      await removeStoredCaseTwoVideo();
      setStoredVideoAvailable(false);
      setPersistOnDevice(false);
      setPrivateMediaConsent("case-02", false);
      setStorageState(asset ? "session" : "session");
      if (asset) {
        const current = sessionRef.current;
        onSession({ ...current, exams: current.exams.map((item) => ({ ...item, ultrasoundUploads: Object.fromEntries(Object.entries(item.ultrasoundUploads).map(([id, value]) => [id, value ? { ...value, storage: "session" as const } : value])) })) });
      }
    } catch {
      setStorageState("error");
    }
  }

  async function clearPrivateMedia() {
    if (asset?.storage === "built-in" && !storedVideoAvailable) return;
    if (!window.confirm("Clear the Case 2 replacement and restore the built-in composite video?")) return;
    try {
      if (supportsPrivateMediaStorage()) await removeStoredCaseTwoVideo();
      setStoredVideoAvailable(false);
      setPersistOnDevice(false);
      removeCompositeFromSession();
    } catch {
      setStorageState("error");
    }
  }

  async function exportBundle() {
    if (!asset || asset.storage === "built-in") return;
    try {
      const blob = await (await fetch(asset.url)).blob();
      const item: PrivateMediaBundleItem = { slot: caseTwoCompositeId, blob, name: asset.name, type: asset.type || blob.type || "application/octet-stream", lastModified: asset.lastModified ?? Date.now() };
      downloadPrivateMediaBundle("case-02", createPrivateMediaBundle("case-02", [item]));
      setTransferMessage("Exported the original Case 2 composite video in a local-only bundle.");
    } catch { setTransferMessage("Unable to export the Case 2 private media bundle."); }
  }

  async function importBundle(file?: File) {
    if (!file) return;
    try {
      const [item] = await parsePrivateMediaBundle(file, "case-02", [caseTwoCompositeId]);
      let storage: UploadedAsset["storage"] = "session";
      if (persistOnDevice && supportsPrivateMediaStorage()) { await storeCaseTwoVideo(item.blob, item); setStoredVideoAvailable(true); storage = "device"; }
      attachComposite(item.blob, item.name, storage, item);
      setTransferMessage("Imported the Case 2 composite video locally. No network transfer occurred.");
    } catch (error) { setTransferMessage(error instanceof Error ? error.message : "Unable to import the Case 2 private media bundle."); }
  }

  async function setCompositePersistence(consented: boolean) {
    setPersistOnDevice(consented); setPrivateMediaConsent("case-02", consented);
    if (!consented || !asset || asset.storage === "built-in" || !supportsPrivateMediaStorage()) return;
    try {
      const blob = await (await fetch(asset.url)).blob();
      await storeCaseTwoVideo(blob, { name: asset.name, type: asset.type || blob.type, lastModified: asset.lastModified });
      setStoredVideoAvailable(true); attachComposite(blob, asset.name, "device", asset);
    } catch { setStorageState("error"); }
  }

  function updateReview(reviewed: boolean, verified: boolean) {
    const current = sessionRef.current;
    onSession({ ...current, exams: current.exams.map((item) => ({ ...item, reviewed: { ...item.reviewed, ultrasound: reviewed }, clinicianVerified: { ...item.clinicianVerified, ultrasound: verified } })) });
  }

  function captureFrame() {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const halfWidth = Math.floor(video.videoWidth / 2); const halfHeight = Math.floor(video.videoHeight / 2);
    const coordinates: Record<Exclude<typeof activeView.region, "full">, [number, number]> = { "upper-left": [0, 0], "upper-right": [halfWidth, 0], "lower-left": [0, halfHeight], "lower-right": [halfWidth, halfHeight] };
    const canvas = document.createElement("canvas");
    if (activeView.region === "full") { canvas.width = video.videoWidth; canvas.height = video.videoHeight; canvas.getContext("2d")?.drawImage(video, 0, 0); }
    else { const [x, y] = coordinates[activeView.region]; canvas.width = halfWidth; canvas.height = halfHeight; canvas.getContext("2d")?.drawImage(video, x, y, halfWidth, halfHeight, 0, 0, halfWidth, halfHeight); }
    const link = document.createElement("a"); link.href = canvas.toDataURL("image/png"); link.download = `case-02-${view}-representative-frame.png`; link.click();
  }

  const usingBuiltIn = asset?.storage === "built-in";
  const persistenceMessage = usingBuiltIn ? "The owner-authorized built-in video is served from this protected Preview and remains available after refresh." : storageState === "stored" ? "The replacement is stored only in this authorized browser and restored automatically on later visits." : storageState === "unavailable" ? "Persistent browser storage is unavailable; the replacement remains session-only." : storageState === "error" ? "Browser-local persistence was unavailable or denied; the replacement remains session-only." : "The replacement is session-only unless optional device persistence is selected.";

  return <div className="modality-workspace case-two-ultrasound"><div className="viewer-column">
    <section className="case-two-local-loader" aria-label="Case 2 built-in and browser-local media"><div><span>Built-in Clinical Demo Media</span><h2>Case 2 — Bilateral Parotid Ultrasound Comparison</h2><p>The single owner-authorized, de-identified composite video is preloaded and supplies the complete view plus all four mapped quadrants. Optional replacements are processed only in this browser and are never sent to a server, remote API, cloud storage, or analytics service.</p></div><label className={`case-two-video-input ${asset ? "loaded" : ""}`}><strong>{asset ? "Replace Video" : "Load Case 2 Video"}</strong><span>{asset?.name || "Choose the composite MOV from this device"}</span><input type="file" accept="video/*,.mov" aria-label="Load Case 2 Video" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void loadComposite(file); }} /></label><div className="case-two-private-actions"><label className="case-two-persistence-consent"><input type="checkbox" aria-label="Remember this video on this device" checked={usingBuiltIn ? false : persistOnDevice} disabled={usingBuiltIn || !supportsPrivateMediaStorage()} onChange={(event) => void setCompositePersistence(event.target.checked)} />Remember replacement on this device</label><button disabled={!asset || usingBuiltIn} onClick={() => void exportBundle()}>Export Private Case Media</button><label className="private-media-import">Import Private Case Media<input hidden type="file" accept=".salifusion-media,application/vnd.salifusion.private-media" aria-label="Import Case 2 private media bundle" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void importBundle(file); }} /></label><button disabled={!storedVideoAvailable} onClick={() => void removeStoredVideo()}>Remove Stored Video</button><button disabled={usingBuiltIn && !storedVideoAvailable} onClick={() => void clearPrivateMedia()}>Restore Built-in Video</button></div><div className={`case-two-load-status ${asset ? "loaded" : "pending"}`} role="status"><b>{usingBuiltIn ? "Built-in video ready" : asset ? "Video loaded" : storedVideoAvailable ? "Stored video available" : "Video not loaded"}</b><span>{persistenceMessage} The built-in source returns whenever this demonstration is reset.</span>{transferMessage && <small>{transferMessage}</small>}</div></section>
    <div className="case-two-info-bar"><b>Case 02 | Bilateral Parotid Comparison | B-mode + Doppler</b><span>Right: Reference Gland</span><span>Left: Symptomatic Gland</span></div>
    <div className="case-two-view-tabs" role="tablist" aria-label="Composite ultrasound panel navigation">{caseTwoViews.map((item) => <button key={item.id} role="tab" aria-selected={view === item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><b>{item.label}</b><small>{item.detail}</small></button>)}</div>
    <div ref={stageRef} className={`case-two-composite-stage region-${activeView.region}`} data-testid="case-two-composite-stage">
      <div className="scan-header"><span><i /> Prerecorded Educational Ultrasound Replay</span><div>{activeView.label} · extracted from the same original composite video</div></div>
      {asset ? <div className="case-two-video-viewport"><video ref={videoRef} src={asset.url} controls={view === "full"} playsInline preload="metadata" onLoadedMetadata={(event) => { setDuration(event.currentTarget.duration || 0); event.currentTarget.playbackRate = Number(speed); }} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} /></div> : <div className="empty-media"><div className="scan-lines" /><span>Composite ultrasound video awaiting local import</span><small>Expected source: one simultaneous four-panel recording</small></div>}
    </div>
    <div className="playback-bar case-two-playback"><button onClick={() => void videoRef.current?.play()} disabled={!asset}>Play</button><button onClick={() => videoRef.current?.pause()} disabled={!asset}>Pause</button><button onClick={() => { if (videoRef.current) { videoRef.current.currentTime = 0; void videoRef.current.play(); } }} disabled={!asset}>Replay</button><label className="case-two-timeline"><span>Timeline</span><input aria-label="Case 2 video timeline" type="range" min="0" max={duration || 0} step="0.01" value={Math.min(currentTime, duration || 0)} disabled={!asset} onChange={(event) => { const time = Number(event.target.value); setCurrentTime(time); if (videoRef.current) videoRef.current.currentTime = time; }} /></label><button onClick={captureFrame} disabled={!asset}>Capture representative frame</button><button onClick={() => void stageRef.current?.requestFullscreen()} disabled={!asset}>Enlarge</button><label>Speed<select aria-label="Playback speed" value={speed} onChange={(event) => { setSpeed(event.target.value); if (videoRef.current) videoRef.current.playbackRate = Number(event.target.value); }}><option value="0.5">0.5×</option><option value="1">1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label></div>
    <div className="case-two-panel-map" aria-label="Case 2 quadrant mapping"><article><span>Upper-left</span><b>Right Parotid — B-mode</b><p>Relatively homogeneous reference parenchyma.</p></article><article><span>Upper-right</span><b>Right Parotid — Doppler Imaging</b><p>Comparatively less conspicuous vascular signal.</p></article><article><span>Lower-left</span><b>Left Parotid — B-mode</b><p>Rounded hypoechoic areas and heterogeneous appearance.</p></article><article><span>Lower-right</span><b>Left Parotid — Doppler Imaging</b><p>More conspicuous vascular signals than the right gland.</p></article></div>
    <p className="media-note">All panel views are crops of <code>{caseTwoCompositeId}</code>. No anatomy, echogenicity, contrast, vascular signal, or laterality is altered. The exact Color versus Power Doppler technique is not asserted.</p>
  </div><CaseTwoAnalysisPanel demoCase={demoCase} hasMedia={Boolean(asset)} reviewed={Boolean(canonicalExam.reviewed.ultrasound)} verified={Boolean(canonicalExam.clinicianVerified.ultrasound)} onReview={() => updateReview(true, false)} onVerify={() => updateReview(true, true)} /></div>;
}

function CaseTwoAnalysisPanel({ demoCase, hasMedia, reviewed, verified, onReview, onVerify }: { demoCase: CompetitionCase; hasMedia: boolean; reviewed: boolean; verified: boolean; onReview: () => void; onVerify: () => void }) {
  return <aside className="analysis-panel case-two-analysis"><span className="analysis-eyebrow">Curated educational comparison</span><h2>Bilateral parotid assessment</h2><div className={`provenance ${verified ? "verified" : "pending"}`}><strong>{verified ? "Clinician-reviewed educational scenario" : "Imported media observations require clinician verification"}</strong><p>No live scanner connection or automated image inference is claimed.</p></div>{reviewed ? <><section><h3>Right Parotid — Reference Examination</h3><p>Relatively homogeneous parenchymal echotexture without the conspicuous multifocal hypoechoic changes seen in the left gland. The short clip does not establish whole-gland normality.</p></section><section><h3>Left Parotid — Symptomatic Gland</h3><p>Multiple relatively uniform rounded hypoechoic areas produce a heterogeneous, pomegranate-like appearance. This pattern is nonspecific.</p></section><section><h3>Right Parotid — Doppler Reference</h3><p>Detectable but comparatively less prominent Doppler vascular signal than the symptomatic left gland.</p></section><section><h3>Left Parotid — Doppler Assessment</h3><p>Increased Doppler vascular signals relative to the right gland support active hyperemia in the appropriate clinical context; Doppler alone does not establish infection.</p></section><section><h3>Integrated Ultrasound Assessment</h3><p>{demoCase.ultrasound.interpretation}</p></section><section><h3>Differential diagnosis</h3>{demoCase.ultrasound.differentials.map((item, index) => <div className="differential" key={item.label}><b>{index + 1}. {item.label}</b><p>{item.rationale}</p>{item.opposingEvidence && <small>Opposing evidence: {item.opposingEvidence}</small>}</div>)}</section><ResultSection title="Limitations" items={demoCase.ultrasound.limitations} /><button className="review-button" onClick={onVerify}>{verified ? "Reviewed for this examination" : "Confirm clinician review"}</button></> : <><button className="analysis-action" onClick={onReview} disabled={!hasMedia}>Review educational reference findings</button>{!hasMedia && <p className="analysis-prerequisite">Load the single Case 2 composite video before reviewing the educational reference findings.</p>}</>}</aside>;
}

function MediaPane({ asset, slotLabel, videoRef, speed = 1 }: { asset?: UploadedAsset; slotLabel: string; videoRef?: React.RefObject<HTMLVideoElement | null>; speed?: number }) {
  if (!asset) return <div className="empty-media"><div className="scan-lines" /><span>Educational clip awaiting upload</span><small>{slotLabel}</small></div>;
  return <div className="media-pane"><span className="media-label">{slotLabel}</span>{asset.kind === "video" ? <video ref={videoRef} src={asset.url} controls playsInline preload="metadata" onLoadedMetadata={(event) => { event.currentTarget.playbackRate = speed; }} /> : <Image src={asset.url} alt={slotLabel} width={1200} height={800} unoptimized style={{ width: "100%", height: "100%", objectFit: "contain" }} />}</div>;
}

function SialographyWorkspace({ demoCase, exam, recommendation, onExam }: { demoCase: CompetitionCase; exam: GlandExam; recommendation: ReturnType<typeof getDuctalRecommendation>; onExam: (exam: GlandExam) => void }) {
  async function importPhase(phase: SialographyPhase, file?: File) { if (!file) return; const old = exam.phaseUploads[phase]; if (old?.objectUrl) URL.revokeObjectURL(old.url); let storage: PhaseAsset["storage"] = "session"; if (demoCase.id === "case-01" && hasPrivateMediaConsent("case-01") && supportsPrivateMediaStorage()) { try { await storePrivateMedia("case-01", caseOnePhaseSlots[phase], file, { name: file.name, type: file.type, lastModified: file.lastModified }); storage = "device"; } catch { storage = "session"; } } onExam({ ...exam, phaseUploads: { ...exam.phaseUploads, [phase]: { name: file.name, url: URL.createObjectURL(file), objectUrl: true, storage, type: file.type, lastModified: file.lastModified } }, reviewed: { ...exam.reviewed, sialography: false }, clinicianVerified: { ...exam.clinicianVerified, sialography: false } }); }
  const available = phases.filter((phase) => exam.phaseUploads[phase]);
  function removePhase(phase: SialographyPhase) { const asset = exam.phaseUploads[phase]; if (asset?.objectUrl) URL.revokeObjectURL(asset.url); const next = { ...exam.phaseUploads }; delete next[phase]; if (demoCase.id === "case-01" && supportsPrivateMediaStorage()) void removeStoredPrivateMedia("case-01", caseOnePhaseSlots[phase]); onExam({ ...exam, phaseUploads: next, reviewed: { ...exam.reviewed, sialography: false }, clinicianVerified: { ...exam.clinicianVerified, sialography: false } }); }
  return <div className="modality-workspace sialography-layout"><div className="viewer-column"><RecommendationBanner recommendation={recommendation} /><header className="workspace-subhead"><div><span>Four-phase study</span><h2>Independent phase import</h2></div><p>Each browser-local phase keeps its own source, interpretation, timing, enlargement, and replacement control.</p></header><div className="phase-grid">{phases.map((phaseId) => <PhaseCard key={phaseId} fixture={demoCase.sialographyPhases[phaseId]} asset={exam.phaseUploads[phaseId]} onImport={(file) => importPhase(phaseId, file)} onRemove={() => removePhase(phaseId)} />)}</div><p className="phase-status">{available.length ? `${available.length} of 4 phases available: ${available.map((phaseId) => phaseLabels[phaseId]).join(", ")}.${available.length < 4 ? " Missing phases remain documented limitations." : ""}` : "Educational Scenario Findings — Awaiting Image Verification"}</p></div><AnalysisPanel title="2D sialography educational analysis" demoCase={demoCase} modality="sialography" verified={Boolean(exam.clinicianVerified.sialography)} reviewed={Boolean(exam.reviewed.sialography)} onReview={() => onExam({ ...exam, reviewed: { ...exam.reviewed, sialography: true } })} onVerify={() => onExam({ ...exam, clinicianVerified: { ...exam.clinicianVerified, sialography: true }, reviewed: { ...exam.reviewed, sialography: true } })} />
  </div>;
}

function PhaseCard({ fixture, asset, onImport, onRemove }: { fixture: SialographyPhaseFixture; asset?: PhaseAsset; onImport: (file?: File) => void; onRemove: () => void }) {
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const previewRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);
  const reset = () => setView({ scale: 1, x: 0, y: 0 });
  const status = asset?.storage === "built-in" ? "Built-in" : asset ? "Available" : fixture.availability === "not-provided" ? "Not Provided" : "Awaiting image";
  function pointerDown(event: React.PointerEvent<HTMLDivElement>) { if (!asset) return; drag.current = { x: event.clientX, y: event.clientY, originX: view.x, originY: view.y }; event.currentTarget.setPointerCapture(event.pointerId); }
  function pointerMove(event: React.PointerEvent<HTMLDivElement>) { if (!drag.current) return; setView((current) => ({ ...current, x: drag.current!.originX + event.clientX - drag.current!.x, y: drag.current!.originY + event.clientY - drag.current!.y })); }
  return <article className={asset ? "phase-card available" : "phase-card"}>
    <div className="phase-card-head"><span>{fixture.label}</span><b>{status}</b></div>
    <div ref={previewRef} className={asset ? "phase-preview pannable" : "phase-preview"} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={() => { drag.current = null; }}>
      {asset ? <Image draggable={false} src={asset.url} alt={`${fixture.label} upload`} width={600} height={420} unoptimized style={{ width: "100%", height: "100%", objectFit: "contain", transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }} /> : <span>{fixture.availability === "not-provided" ? "Not Provided" : "Educational Scenario Findings — Awaiting Image Verification"}</span>}
    </div>
    {asset && <div className="phase-view-controls" aria-label={`${fixture.label} image controls`}><button aria-label={`Zoom out ${fixture.label}`} onClick={() => setView((current) => ({ ...current, scale: Math.max(.75, current.scale - .25) }))}>−</button><span>{Math.round(view.scale * 100)}%</span><button aria-label={`Zoom in ${fixture.label}`} onClick={() => setView((current) => ({ ...current, scale: Math.min(3, current.scale + .25) }))}>+</button><button onClick={reset}>Reset</button><button onClick={() => void previewRef.current?.requestFullscreen()}>Expand</button></div>}
    <details className="phase-interpretation"><summary>Phase-specific interpretation{fixture.timing ? ` · ${fixture.timing}` : ""}</summary>{fixture.findings.length ? <ul>{fixture.findings.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No phase finding is asserted.</p>}<p>{fixture.interpretation}</p>{fixture.limitations.map((item) => <small key={item}>{item}</small>)}</details>
    <div className="phase-actions"><label>{asset ? "Replace image" : "Upload image"}<input hidden type="file" aria-label={`Upload ${fixture.label}`} onChange={(event) => { reset(); onImport(event.target.files?.[0]); }} /></label>{asset?.objectUrl && <button onClick={() => { reset(); onRemove(); }}>Remove</button>}</div>
  </article>;
}

function CbctWorkspace({ demoCase, exam, recommendation, onExam }: { demoCase: CompetitionCase; exam: GlandExam; recommendation: ReturnType<typeof getDuctalRecommendation>; onExam: (exam: GlandExam) => void }) {
  const [busy, setBusy] = useState(false); const selected = exam.dicomSeries.find((item) => item.uid === exam.selectedSeriesUid) ?? exam.dicomSeries[0];
  async function importDicom(list: FileList | null) { if (!list?.length) return; setBusy(true); try { const series = await groupDicomSeries(Array.from(list)); if (series.every((item) => item.instances.length < 2)) throw new Error("No multi-slice DICOM series was found."); onExam({ ...exam, dicomSeries: series, selectedSeriesUid: series[0].uid, dicomError: "", reviewed: { ...exam.reviewed, cbct: false } }); } catch (reason) { onExam({ ...exam, dicomSeries: [], selectedSeriesUid: "", dicomError: reason instanceof Error ? reason.message : "DICOM import failed." }); } finally { setBusy(false); } }
  function importImages(list: FileList | null) { if (!list?.length) return; exam.cbctImages.forEach((item) => URL.revokeObjectURL(item.url)); onExam({ ...exam, cbctImages: Array.from(list).map((file) => ({ name: file.name, url: URL.createObjectURL(file), objectUrl: true })), reviewed: { ...exam.reviewed, cbct: false } }); }
  return <div className="modality-workspace cbct-layout"><div className="viewer-column"><RecommendationBanner recommendation={recommendation} /><div className="cbct-imports"><label><span>Volumetric pathway</span><strong>{busy ? "Reading DICOM…" : "Import DICOM Study"}</strong><small>Multi-slice local DICOM · genuine MPR when spatial metadata is valid</small><input hidden type="file" multiple accept=".dcm,application/dicom" aria-label="Import DICOM Study" onChange={(event) => void importDicom(event.target.files)} /></label><label><span>Image pathway</span><strong>Import CBCT Image / Screenshot</strong><small>JPEG or PNG · always labeled 2D Image Review</small><input hidden type="file" multiple accept="image/png,image/jpeg" aria-label="Import CBCT Image or Screenshot" onChange={(event) => importImages(event.target.files)} /></label></div>
    {exam.dicomError && <div className="inline-warning red">{exam.dicomError}</div>}
    {selected && <div className="dicom-view"><div className="viewer-type"><span>True DICOM Volume · MPR</span><select value={selected.uid} aria-label="DICOM series" onChange={(event) => onExam({ ...exam, selectedSeriesUid: event.target.value })}>{exam.dicomSeries.map((series) => <option key={series.uid} value={series.uid}>{series.description} · {series.instances.length} slices</option>)}</select></div><Suspense fallback={<div className="viewer-loading">Loading volumetric viewer…</div>}><MprViewer series={selected} /></Suspense></div>}
    {!selected && exam.cbctImages.length > 0 && <div className="dicom-view"><div className="viewer-type warning">2D Image Review · Not a volumetric DICOM study</div><Suspense fallback={<div className="viewer-loading">Loading image viewer…</div>}><ImageViewer images={exam.cbctImages.map((item) => ({ src: item.url, alt: item.name, name: item.name, objectUrl: true }))} /></Suspense></div>}
    {!selected && exam.cbctImages.length === 0 && <div className="empty-cbct"><span>CBCT workspace ready</span><p>Import a spatially valid DICOM series for multiplanar reconstruction, or a still image for clearly labeled 2D review.</p></div>}
  </div><AnalysisPanel title="CBCT educational analysis" demoCase={demoCase} modality="cbct" verified={Boolean(exam.clinicianVerified.cbct)} reviewed={Boolean(exam.reviewed.cbct)} onReview={() => onExam({ ...exam, reviewed: { ...exam.reviewed, cbct: true } })} onVerify={() => onExam({ ...exam, clinicianVerified: { ...exam.clinicianVerified, cbct: true }, reviewed: { ...exam.reviewed, cbct: true } })} disabled={!selected && exam.cbctImages.length === 0} />
  </div>;
}

function RecommendationBanner({ recommendation }: { recommendation: ReturnType<typeof getDuctalRecommendation> }) { return <article className={`recommendation-banner ${recommendation.state}`}><div><span>{recommendation.state === "appropriate" ? "Eligible pathway" : recommendation.state === "defer" ? "Safety stop" : "Clinical precaution"}</span><h2>{recommendation.title}</h2><p>{recommendation.explanation}</p></div><ul>{recommendation.considerations.map((item) => <li key={item}>{item}</li>)}</ul></article>; }

function AnalysisPanel({ title, demoCase, modality, reviewed, verified, onReview, onVerify, disabled = false }: { title: string; demoCase: CompetitionCase; modality: "ultrasound" | "sialography" | "cbct"; reviewed: boolean; verified: boolean; onReview: () => void; onVerify: () => void; disabled?: boolean }) {
  const fixture = demoCase[modality];
  return <aside className="analysis-panel"><span className="analysis-eyebrow">Evidence-aware result</span><h2>{title}</h2><div className={`provenance ${verified ? "verified" : "pending"}`}><strong>{verified ? "Clinician-reviewed educational scenario" : "Educational Scenario Findings — Awaiting Image Verification"}</strong><p>Preset findings are not an automated analysis of arbitrary uploads.</p></div>{reviewed ? <><ResultSection title="Observed findings" items={fixture.observedFindings.length ? fixture.observedFindings : ["No supported findings documented."]} /><section><h3>Interpretation</h3><p>{fixture.interpretation}</p></section><section><h3>Differential diagnosis</h3>{fixture.differentials.length ? fixture.differentials.map((item, index) => <div className="differential" key={item.label}><b>{index + 1}. {item.label}</b><p>{item.rationale}</p>{item.opposingEvidence && <small>Opposing evidence: {item.opposingEvidence}</small>}</div>) : <p>Not applicable in this state.</p>}</section><ResultSection title="Limitations" items={fixture.limitations} /><ResultSection title="Recommendations" items={fixture.recommendations} /><button className="review-button" onClick={onVerify} disabled={disabled}>{verified ? "Reviewed for this examination" : "Confirm clinician review"}</button></> : <button className="analysis-action" onClick={onReview} disabled={disabled}>Review educational reference findings</button>}</aside>;
}

function ResultSection({ title, items }: { title: string; items: string[] }) { return <section><h3>{title}</h3><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></section>; }
