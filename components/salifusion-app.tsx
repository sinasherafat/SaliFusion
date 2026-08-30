"use client";

import { lazy, Suspense, useState } from "react";
import Image from "next/image";
import { curatedAssetsForModality, DEMO_CASES, findCuratedAsset } from "@/data/demo-cases";
import { groupDicomSeries } from "@/lib/dicom/parse-dicom";
import { getCornerstoneRuntime } from "@/lib/cornerstone/runtime";
import { serviceForCase } from "@/services/analysis";
import { FusionService } from "@/services/fusion-service";
import { ReportService } from "@/services/report-service";
import type { AnalysisResult, AnalyzedStudy, Concordance, DemoAsset, DemoCase, DicomSeries, IntegratedReport, Modality, PatientInfo, ReviewDecision } from "@/types/salifusion";
import type { FallbackImage } from "@/components/viewers/fallback-image-viewer";

const StackViewer = lazy(() => import("@/components/viewers/cornerstone-stack-viewer").then((module) => ({ default: module.CornerstoneStackViewer })));
const MprViewer = lazy(() => import("@/components/viewers/cornerstone-mpr-viewer").then((module) => ({ default: module.CornerstoneMprViewer })));
const ImageViewer = lazy(() => import("@/components/viewers/fallback-image-viewer").then((module) => ({ default: module.FallbackImageViewer })));

type Screen = "start" | "patient" | "modality" | "cases" | "review" | "results" | "report";
interface UploadState { series: DicomSeries[]; selectedUid: string; fallback: FallbackImage[]; error: string; progress: number; total: number }

const symptoms = ["Pain", "Swelling", "Meal-related symptoms", "Recurrent swelling", "Xerostomia", "Fever", "Palpable mass"];
const modalityInfo: { id: Modality; title: string; detail: string; formats: string }[] = [
  { id: "ultrasound", title: "Ultrasound", detail: "Single-frame medical image review", formats: "DICOM · JPG · PNG" },
  { id: "sialography_2d", title: "2D Sialography", detail: "Single or sequential examination images", formats: "DICOM · JPG · PNG" },
  { id: "cbct_3d", title: "3D / CBCT Sialography", detail: "Spatial series with true orthographic MPR", formats: "DICOM series / folder" },
  { id: "mr_sialography", title: "MR Sialography", detail: "MR ductal image review pathway", formats: "DICOM · JPG · PNG" },
];
const initialPatient: PatientInfo = { patientName: "", patientId: "", age: "", sex: "", gland: "", side: "", symptoms: [], clinicalNotes: "" };
const emptyUpload = (): UploadState => ({ series: [], selectedUid: "", fallback: [], error: "", progress: 0, total: 0 });

function modalityTitle(modality: Modality) {
  return modalityInfo.find((item) => item.id === modality)?.title ?? modality;
}

function selectedSeries(upload: UploadState) {
  return upload.series.find((series) => series.uid === upload.selectedUid) ?? upload.series[0] ?? null;
}

function hasUpload(upload: UploadState) {
  return upload.series.length > 0 || upload.fallback.length > 0;
}

export function SaliFusionApp() {
  const [screen, setScreen] = useState<Screen>("start");
  const [patient, setPatient] = useState<PatientInfo>(initialPatient);
  const [modality, setModality] = useState<Modality | null>(null);
  const [demoCase, setDemoCase] = useState<DemoCase | null>(null);
  const [demoAsset, setDemoAsset] = useState<DemoAsset | null>(null);
  const [upload, setUpload] = useState<UploadState>(emptyUpload);
  const [analyzedStudies, setAnalyzedStudies] = useState<AnalyzedStudy[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [report, setReport] = useState<IntegratedReport | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [clinicianNote, setClinicianNote] = useState("");

  const workflowScreen = screen === "cases" ? "start" : screen;
  const step = ({ start: 0, patient: 1, modality: 2, review: 3, results: 4, report: 5 } as Record<string, number>)[workflowScreen] ?? 0;
  const series = selectedSeries(upload);
  const usedModalities = analyzedStudies.map((study) => study.modality);

  function revoke(state: UploadState) {
    state.fallback.forEach((item) => { if (item.objectUrl) URL.revokeObjectURL(item.src); });
  }

  function resetCurrentImport() {
    revoke(upload);
    setUpload(emptyUpload());
    setDemoCase(null);
    setDemoAsset(null);
  }

  function clearStudy() {
    revoke(upload);
    setUpload(emptyUpload());
    setAnalysisResult(null);
    setAnalyzedStudies([]);
    setReport(null);
    setDemoCase(null);
    setDemoAsset(null);
    setModality(null);
    setPatient(initialPatient);
    setClinicianNote("");
    void getCornerstoneRuntime().then(({ core, dicom }) => { dicom.wadouri.fileManager.purge(); core.cache.purgeCache(); }).catch(() => undefined);
  }

  function startNew() { clearStudy(); setScreen("patient"); }
  function home() { clearStudy(); setScreen("start"); }
  function openCases() { clearStudy(); setScreen("cases"); }

  function chooseDemo(item: DemoCase) {
    const asset = item.assets.find((candidate) => candidate.modality === item.modality) ?? item.assets[0];
    setDemoCase(item);
    setDemoAsset(asset);
    setModality(asset.modality);
    setPatient({
      patientName: "Curated Demo Patient",
      patientId: `DEMO-${item.id.slice(0, 8).toUpperCase()}`,
      age: "47",
      sex: "Female",
      gland: "Parotid",
      side: "Left",
      symptoms: item.id.includes("sialolith") ? ["Pain", "Meal-related symptoms"] : ["Swelling"],
      clinicalNotes: "Curated competition demonstration case.",
    });
    setScreen("review");
  }

  function loadCuratedAsset(item: DemoCase, asset: DemoAsset) {
    revoke(upload);
    setUpload(emptyUpload());
    setDemoCase(item);
    setDemoAsset(asset);
    setModality(asset.modality);
  }

  async function importFiles(list: FileList | null) {
    if (!list?.length || !modality) return;
    const files = Array.from(list).filter((file) => file.size > 0);
    revoke(upload);
    setDemoCase(null);
    setDemoAsset(null);
    setUpload({ ...emptyUpload(), total: files.length });
    const imageFiles = files.filter((file) => file.type === "image/jpeg" || file.type === "image/png" || /\.(jpe?g|png)$/i.test(file.name));
    if (imageFiles.length === files.length) {
      const recognized = files.length === 1 ? findCuratedAsset(files[0].name, modality) : null;
      if (recognized) {
        setDemoCase(recognized.demoCase);
        setDemoAsset(recognized.asset);
      }
      setUpload({ ...emptyUpload(), fallback: imageFiles.map((file) => ({ src: URL.createObjectURL(file), alt: file.name, name: file.name, objectUrl: true })) });
      return;
    }
    try {
      const grouped = await groupDicomSeries(files, (progress, total) => setUpload((value) => ({ ...value, progress, total })));
      if (modality === "cbct_3d" && grouped.every((item) => item.instances.length < 2)) throw new Error("No multi-slice DICOM series was found in the selected folder.");
      setUpload({ ...emptyUpload(), series: grouped, selectedUid: grouped[0].uid, progress: files.length, total: files.length });
    } catch (reason) {
      setUpload({ ...emptyUpload(), error: reason instanceof Error ? reason.message : "The selected files could not be read." });
    }
  }

  async function runAnalysis() {
    if (!demoCase || !demoAsset || !modality) return;
    setAnalyzing(true);
    try {
      const result = await serviceForCase(demoCase, modality).analyze(demoCase, modality);
      const study: AnalyzedStudy = { caseId: demoCase.id, modality, asset: demoAsset, result };
      const nextStudies = [...analyzedStudies.filter((item) => item.modality !== modality), study];
      setAnalyzedStudies(nextStudies);
      setAnalysisResult(new FusionService().combine(nextStudies));
      setReport(null);
      setScreen("results");
    } finally {
      setAnalyzing(false);
    }
  }

  function updateConcordance(value: Concordance) {
    if (analyzedStudies.length < 2) return;
    const base = new FusionService().combine(analyzedStudies);
    setAnalysisResult(new FusionService().withConcordance(base, value));
  }

  function addAnotherModality() {
    resetCurrentImport();
    setModality(null);
    setScreen("modality");
  }

  function generateReport() {
    if (!analysisResult) return;
    setReport(new ReportService().create(patient, analyzedStudies, analysisResult));
    setClinicianNote("");
    setScreen("report");
  }

  function reviewReport(decision: ReviewDecision) {
    if (!report) return;
    setReport(new ReportService().review(report, decision, clinicianNote));
  }

  return (
    <div className="app-root">
      {screen !== "start" && <AppHeader onHome={home} step={step} />}
      {screen === "start" && <StartScreen onStart={startNew} onDemo={openCases} />}
      {screen === "patient" && <PatientScreen patient={patient} setPatient={setPatient} onBack={home} onNext={() => setScreen("modality")} />}
      {screen === "modality" && (
        <ModalityScreen
          selected={modality}
          usedModalities={usedModalities}
          adding={analyzedStudies.length > 0}
          onSelect={setModality}
          onBack={() => setScreen(analyzedStudies.length ? "results" : "patient")}
          onNext={() => modality && setScreen("review")}
        />
      )}
      {screen === "cases" && <CasesScreen onSelect={chooseDemo} onBack={home} />}
      {screen === "review" && modality && (
        <ReviewScreen
          modality={modality}
          demoCase={demoCase}
          demoAsset={demoAsset}
          upload={upload}
          series={series}
          analyzedCount={analyzedStudies.length}
          onLoadCurated={loadCuratedAsset}
          onImport={importFiles}
          setUpload={setUpload}
          onBack={() => setScreen("modality")}
          onAnalyze={runAnalysis}
          analyzing={analyzing}
          onOpenRealCbct={resetCurrentImport}
        />
      )}
      {screen === "results" && analysisResult && (
        <ResultsScreen
          result={analysisResult}
          studies={analyzedStudies}
          onBack={() => setScreen("review")}
          onAdd={addAnotherModality}
          onReport={generateReport}
          onConcordance={updateConcordance}
        />
      )}
      {screen === "report" && report && (
        <ReportScreen
          report={report}
          clinicianNote={clinicianNote}
          setClinicianNote={setClinicianNote}
          onReview={reviewReport}
          onBack={() => setScreen("results")}
          onNew={startNew}
        />
      )}
    </div>
  );
}

function AppHeader({ onHome, step }: { onHome: () => void; step: number }) {
  const names = ["Patient", "Modality", "Import & Review", "Results", "Report"];
  return <header className="app-header"><button className="brand-button" type="button" onClick={onHome}><span className="brand-mark">SF</span><span>SaliFusion AI<small>Research demonstration</small></span></button><ol className="stepper">{names.map((name, index) => <li key={name} className={step >= index + 1 ? "complete" : ""}><span>{index + 1}</span>{name}</li>)}</ol><span className="local-badge">Local imaging</span></header>;
}

function StartScreen({ onStart, onDemo }: { onStart: () => void; onDemo: () => void }) {
  return <main className="start-screen"><header className="start-header"><div className="brand"><span className="brand-mark">SF</span>SaliFusion AI</div><span className="privacy-note">Local-first medical image review</span></header><section className="hero"><div><p className="eyebrow">Functional medical imaging proof of concept</p><h1>SaliFusion AI</h1><p className="subtitle">Multimodal AI-Assisted Assessment of Salivary Gland Diseases</p><div className="actions"><button className="button button-primary" type="button" onClick={onStart}>Start New Analysis</button><button className="button button-secondary" type="button" onClick={onDemo}>Open Demo Case</button></div><p className="integrity-note">Image import and visualization are functional. Diagnostic AI output is simulated only for curated cases.</p></div><aside className="workflow-card" aria-label="Analysis workflow"><p className="card-kicker">Competition workflow · under 60 seconds</p><h2>A focused clinical review</h2><ol className="workflow-list">{["Patient information", "Select first modality", "Import medical images", "Run curated analysis", "Optionally add a modality", "Generate the report"].map((item, index) => <li key={item}><span>{index + 1}</span>{item}</li>)}</ol></aside></section><footer className="start-footer">Research demonstration only · Not for clinical diagnosis</footer></main>;
}

function PatientScreen({ patient, setPatient, onBack, onNext }: { patient: PatientInfo; setPatient: (value: PatientInfo) => void; onBack: () => void; onNext: () => void }) {
  const valid = (patient.patientName.trim() || patient.patientId.trim()) && patient.age && patient.sex && patient.gland && patient.side;
  const update = (key: keyof PatientInfo, value: string) => setPatient({ ...patient, [key]: value });
  return <PageShell eyebrow="Step 1" title="Patient information" intro="Use only de-identified or fictional data in this demonstration."><div className="form-card"><div className="form-grid"><label>Patient Name<input value={patient.patientName} onChange={(e) => update("patientName", e.target.value)} placeholder="Name or initials" autoComplete="off" /></label><label>Patient ID<input value={patient.patientId} onChange={(e) => update("patientId", e.target.value)} placeholder="e.g. DEMO-001" autoComplete="off" /></label><label>Age<input value={patient.age} onChange={(e) => update("age", e.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" placeholder="Age" /></label><label>Sex<select value={patient.sex} onChange={(e) => update("sex", e.target.value)}><option value="">Select</option><option>Female</option><option>Male</option><option>Other</option><option>Not specified</option></select></label><label>Gland<select value={patient.gland} onChange={(e) => update("gland", e.target.value)}><option value="">Select</option><option>Parotid</option><option>Submandibular</option></select></label><label>Side<select value={patient.side} onChange={(e) => update("side", e.target.value)}><option value="">Select</option><option>Right</option><option>Left</option><option>Bilateral</option></select></label></div><fieldset><legend>Symptoms</legend><div className="chip-grid">{symptoms.map((symptom) => <label className="check-chip" key={symptom}><input type="checkbox" checked={patient.symptoms.includes(symptom)} onChange={(e) => setPatient({ ...patient, symptoms: e.target.checked ? [...patient.symptoms, symptom] : patient.symptoms.filter((item) => item !== symptom) })} /><span>{symptom}</span></label>)}</div></fieldset><label className="notes-field">Clinical History / Notes<textarea value={patient.clinicalNotes} onChange={(e) => update("clinicalNotes", e.target.value)} placeholder="Short relevant clinical history or examination note" /></label><p className="field-help">Enter at least a patient name or patient ID. Age, sex, gland, and side are also required.</p></div><Navigation onBack={onBack} onNext={onNext} nextDisabled={!valid} nextLabel="Continue to modality" /></PageShell>;
}

function ModalityScreen({ selected, usedModalities, adding, onSelect, onBack, onNext }: { selected: Modality | null; usedModalities: Modality[]; adding: boolean; onSelect: (value: Modality) => void; onBack: () => void; onNext: () => void }) {
  return <PageShell eyebrow="Step 2" title={adding ? "Add another modality" : "Select imaging pathway"} intro={adding ? "The next analyzed modality will be fused automatically with this patient’s existing study." : "Choose the first modality available for this examination."}><div className="modality-grid">{modalityInfo.map((item, index) => { const used = usedModalities.includes(item.id); return <button key={item.id} type="button" disabled={used} className={`modality-card ${selected === item.id ? "selected" : ""}`} onClick={() => onSelect(item.id)}><span className="modality-number">0{index + 1}</span><strong>{item.title}</strong><span>{item.detail}</span><small>{used ? "Already analyzed for this patient" : item.formats}</small></button>; })}</div><Navigation onBack={onBack} onNext={onNext} nextDisabled={!selected} nextLabel="Continue to image import" /></PageShell>;
}

function CasesScreen({ onSelect, onBack }: { onSelect: (item: DemoCase) => void; onBack: () => void }) {
  return <PageShell eyebrow="Curated demonstration" title="Open a competition case" intro="This shortcut imports the first predefined image for one of six clinical cases. Complementary imaging can be added after analysis."><div className="case-grid">{DEMO_CASES.map((item) => <button type="button" className="case-card" key={item.id} onClick={() => onSelect(item)}><div className="case-thumb"><Image src={item.assets[0].src} alt="" width={440} height={280} /></div><span className="case-mode">{modalityTitle(item.modality)}</span><strong>{item.shortTitle}</strong><p>{item.message}</p><span className="case-action">Import demo image →</span></button>)}</div><Navigation onBack={onBack} /></PageShell>;
}

interface ReviewProps {
  modality: Modality;
  demoCase: DemoCase | null;
  demoAsset: DemoAsset | null;
  upload: UploadState;
  series: DicomSeries | null;
  analyzedCount: number;
  onLoadCurated: (demoCase: DemoCase, asset: DemoAsset) => void;
  onImport: (list: FileList | null) => void;
  setUpload: React.Dispatch<React.SetStateAction<UploadState>>;
  onBack: () => void;
  onAnalyze: () => void;
  analyzing: boolean;
  onOpenRealCbct: () => void;
}

function ReviewScreen(props: ReviewProps) {
  const { modality, demoCase, demoAsset, upload, series, analyzedCount, onLoadCurated, onImport, setUpload, onBack, onAnalyze, analyzing, onOpenRealCbct } = props;
  const available = curatedAssetsForModality(modality);
  const imageReady = Boolean(demoCase && demoAsset) || hasUpload(upload);
  return <main className="workspace-page"><div className="workspace-heading"><div><p className="eyebrow">Step 3 · Import & review</p><h2>{demoCase ? demoCase.title : modalityTitle(modality)}</h2><p>{demoCase?.message ?? "Files remain in this browser session and are not uploaded to an AI service."}</p>{analyzedCount > 0 && <span className="auto-fusion-badge">Adding modality {analyzedCount + 1} · fusion will start automatically after analysis</span>}</div><button className="text-button" type="button" onClick={onBack}>← Back</button></div>
    <CuratedImportPanel modality={modality} available={available} selected={demoAsset} onSelect={onLoadCurated} />
    {demoCase && demoAsset ? <CuratedViewer asset={demoAsset} /> : <UploadWorkspace title={modalityTitle(modality)} modality={modality} state={upload} series={series} onImport={onImport} setState={setUpload} />}
    {demoAsset?.modality === "cbct_3d" && <div className="cbct-separation-note"><div><strong>Curated reference is separate from the functional MPR viewer</strong><p>Open the real CBCT workspace to select a DICOM folder, build a volume, and review axial/coronal/sagittal MPR.</p></div><button type="button" className="button button-secondary" onClick={onOpenRealCbct}>Open real CBCT import</button></div>}
    <div className="analysis-bar"><div>{demoCase && demoAsset ? <><strong>Curated image recognized</strong><span>Predefined case-specific analysis is available.</span></> : imageReady ? <><strong>Image loaded successfully.</strong><span>AI inference is currently available only for curated demonstration cases.</span></> : modality === "mr_sialography" ? <><strong>No predefined MR demo case is packaged</strong><span>Images can be reviewed, but simulated analysis will remain unavailable.</span></> : <><strong>Import images to begin review</strong><span>DICOM is processed locally in your browser.</span></>}</div><button type="button" className="button button-primary" disabled={!demoCase || !demoAsset || analyzing} onClick={onAnalyze}>{analyzing ? "Analyzing demonstration…" : "Run AI Analysis"}</button></div>
  </main>;
}

function CuratedImportPanel({ modality, available, selected, onSelect }: { modality: Modality; available: { demoCase: DemoCase; asset: DemoAsset }[]; selected: DemoAsset | null; onSelect: (demoCase: DemoCase, asset: DemoAsset) => void }) {
  if (!available.length) return <section className="curated-import-panel"><div><span className="section-label">Packaged demonstration images</span><strong>No predefined demo case is currently packaged for MR Sialography.</strong><p>You may still import DICOM, JPG, or PNG images for local viewing. Diagnostic output will not be fabricated.</p></div></section>;
  return <section className="curated-import-panel"><div><span className="section-label">Import a packaged {modalityTitle(modality)} image</span><p>Selecting one of these assets follows the same deterministic recognition path as importing its exact filename.</p></div><div className="curated-import-actions">{available.map(({ demoCase, asset }) => <button type="button" className={selected?.src === asset.src ? "selected" : ""} key={asset.src} onClick={() => onSelect(demoCase, asset)}><span>Import demo image</span><strong>{demoCase.shortTitle}</strong><small>{asset.src.split("/").at(-1)}</small></button>)}</div></section>;
}

function CuratedViewer({ asset }: { asset: DemoAsset }) {
  return <div className="curated-grid"><figure className="curated-panel"><figcaption>{modalityTitle(asset.modality)}<span>Curated reference image</span></figcaption><div className="curated-image"><Image src={asset.src} alt={asset.alt} width={1000} height={760} priority /></div></figure></div>;
}

function UploadWorkspace({ title, modality, state, series, onImport, setState }: { title: string; modality: Modality; state: UploadState; series: DicomSeries | null; onImport: ReviewProps["onImport"]; setState: React.Dispatch<React.SetStateAction<UploadState>> }) {
  const directory = modality === "cbct_3d";
  const inputProps = directory ? ({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>) : {};
  return <section className="upload-workspace"><div className="upload-topline"><div><span className="section-label">{title}</span><p>{directory ? "Select a folder or multiple DICOM files for MPR, or a JPG/PNG exported reference for sequential viewing." : "Select DICOM, JPG, or PNG files. Multiple images preserve examination order."}</p></div>{directory ? <div className="file-button-group"><label className="file-button">Select DICOM folder<input type="file" multiple accept=".dcm,application/dicom" {...inputProps} onChange={(event) => void onImport(event.target.files)} /></label><label className="file-button secondary">Select files<input type="file" multiple accept=".dcm,application/dicom,image/jpeg,image/png" onChange={(event) => void onImport(event.target.files)} /></label></div> : <label className="file-button">Select images<input type="file" multiple accept=".dcm,application/dicom,image/jpeg,image/png" onChange={(event) => void onImport(event.target.files)} /></label>}</div>
    {state.total > 0 && state.progress < state.total && <div className="progress-row"><progress value={state.progress} max={state.total} /><span>Reading {state.progress} of {state.total}</span></div>}
    {state.error && <div className="error-banner"><strong>Unable to load images</strong><span>{state.error}</span></div>}
    {state.series.length > 1 && <label className="series-selector">DICOM series<select value={state.selectedUid} onChange={(event) => setState((value) => ({ ...value, selectedUid: event.target.value }))}>{state.series.map((item) => <option value={item.uid} key={item.uid}>{item.description} · {item.modality} · {item.instances.length} images</option>)}</select></label>}
    {series?.warning && <div className="warning-banner">{series.warning}</div>}
    <Suspense fallback={<div className="viewer-loading">Loading medical viewer…</div>}>
      {series && modality === "cbct_3d" && <MprViewer series={series} />}
      {series && modality !== "cbct_3d" && <StackViewer series={series} />}
      {state.fallback.length > 0 && <ImageViewer key={state.fallback[0].src} images={state.fallback} />}
      {!series && state.fallback.length === 0 && !state.error && <div className="drop-empty"><strong>No images loaded</strong><span>Use the selector above. Patient files stay local to this browser.</span></div>}
    </Suspense>
    {series && <MetadataPanel series={series} />}
  </section>;
}

function MetadataPanel({ series }: { series: DicomSeries }) {
  const meta = series.instances[0]?.metadata;
  const rows = [["Series", meta.seriesDescription || "Not provided"], ["Modality", meta.modality || "Not provided"], ["Instances", String(series.instances.length)], ["Dimensions", meta.rows && meta.columns ? `${meta.columns} × ${meta.rows}` : "Not provided"], ["Pixel spacing", meta.pixelSpacing?.join(" × ") || "Not provided"], ["Slice thickness", meta.sliceThickness ? `${meta.sliceThickness} mm` : "Not provided"], ["Transfer syntax", meta.transferSyntax || "Not provided"], ["Spatial sorting", series.spatiallySorted ? "Image Position + Orientation" : "Instance Number fallback"]];
  return <details className="metadata-panel"><summary>DICOM metadata</summary><dl>{rows.map(([term, value]) => <div key={term}><dt>{term}</dt><dd>{value}</dd></div>)}</dl><p>Patient/study identifiers are read locally and are not transmitted by this demo.</p></details>;
}

function ResultsScreen({ result, studies, onBack, onAdd, onReport, onConcordance }: { result: AnalysisResult; studies: AnalyzedStudy[]; onBack: () => void; onAdd: () => void; onReport: () => void; onConcordance: (value: Concordance) => void }) {
  const isMultimodal = studies.length > 1;
  return <PageShell eyebrow="Step 4" title={isMultimodal ? "Automatic multimodal result" : "Analysis results"} intro={isMultimodal ? "Multiple analyzed modalities were detected for this patient and fused automatically." : "Structured demonstration output for clinician review."}><div className="disclaimer"><strong>Simulated AI output — proof-of-concept demonstration.</strong><span>Image import and visualization are functional.</span></div>{isMultimodal && <><div className="auto-fusion-notice"><strong>Automatic fusion active</strong><span>{studies.map((study) => modalityTitle(study.modality)).join(" + ")}</span></div><div className="combined-study-grid">{studies.map((study) => <section key={`${study.caseId}-${study.modality}`}><span>{modalityTitle(study.modality)}</span><strong>{study.result.assessment}</strong><BulletList items={study.result.findings} /></section>)}</div><label className="demo-state-control">Competition fusion state<select value={result.concordance ?? "High Concordance"} onChange={(e) => onConcordance(e.target.value as Concordance)}><option>High Concordance</option><option>Partial Concordance</option><option>Discordance Detected</option></select><small>This control preserves the demonstration of concordant, partially concordant, and discordant states.</small></label></>}<div className="results-layout"><section className="result-primary"><ResultSection title={isMultimodal ? "Integrated findings" : "Detected findings"} items={result.findings} /><ResultSection title={isMultimodal ? "Integrated assessment" : "Suggested assessment"} items={[result.assessment]} /><ResultSection title="Differential diagnoses" items={result.differentials.slice(0, 2)} /></section><aside className="result-summary"><div><span>Image quality</span><strong>{result.imageQuality}</strong></div><div><span>Confidence</span><strong className={`confidence ${result.confidence.toLowerCase()}`}>{result.confidence}</strong></div>{result.concordance && <div><span>Cross-modal concordance</span><strong className={result.concordance === "Discordance Detected" ? "discordance" : ""}>{result.concordance === "Discordance Detected" ? "Cross-Modal Discordance Detected" : result.concordance}</strong></div>}</aside></div><div className="support-grid"><ResultSection title="Supporting imaging features" items={result.supportingFeatures} />{result.complementaryFindings?.length ? <ResultSection title="Complementary findings" items={result.complementaryFindings} /> : null}{result.conflictingFindings?.length ? <ResultSection title="Conflicting findings" items={result.conflictingFindings} tone="warning" /> : null}<ResultSection title="Additional Imaging Recommendation" items={[result.additionalImagingRecommendation]} /></div><div className="result-actions"><button type="button" className="button button-secondary" onClick={onBack}>Back to images</button><div><button type="button" className="button button-secondary" onClick={onAdd}>Add Another Modality</button><button type="button" className="button button-primary" onClick={onReport}>{isMultimodal ? "Generate Integrated Report" : "Generate Report"}</button></div></div></PageShell>;
}

function ResultSection({ title, items, tone }: { title: string; items: string[]; tone?: "warning" }) {
  return <section className={`result-section ${tone ?? ""}`}><h3>{title}</h3>{items.length ? <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p>None identified in the curated output.</p>}</section>;
}

function ReportScreen({ report, clinicianNote, setClinicianNote, onReview, onBack, onNew }: { report: IntegratedReport; clinicianNote: string; setClinicianNote: (value: string) => void; onReview: (value: ReviewDecision) => void; onBack: () => void; onNew: () => void }) {
  const { patient, result, studies } = report;
  const isMultimodal = studies.length > 1;
  return <main className="report-page"><div className="report-actions no-print"><button type="button" className="text-button" onClick={onBack}>← Results</button><div><button type="button" className="button button-secondary" onClick={() => window.print()}>Print / Save PDF</button><button type="button" className="button button-primary" onClick={onNew}>New analysis</button></div></div><article className="report-sheet"><header><div><span className="report-logo">SF</span><div><strong>SaliFusion AI</strong><small>{isMultimodal ? "Integrated imaging report" : "Single-modality imaging report"} · proof of concept</small></div></div><span className={`review-status ${report.reviewDecision.toLowerCase()}`}>{report.reviewDecision}</span></header><div className="report-notice">Simulated AI output — proof-of-concept demonstration. Image import and visualization are functional.</div><ReportBlock title="Patient information"><ReportFacts items={[["Patient Name", patient.patientName], ["Patient ID", patient.patientId], ["Age", patient.age], ["Sex", patient.sex], ["Gland", patient.gland], ["Side", patient.side]]} /></ReportBlock><ReportBlock title="Clinical history / notes"><p><strong>Symptoms:</strong> {patient.symptoms.length ? patient.symptoms.join(", ") : "No symptoms selected."}</p><p>{patient.clinicalNotes || "No additional clinical history entered."}</p></ReportBlock>{studies.map((study) => <ReportBlock title={`${modalityTitle(study.modality)} findings`} key={`${study.caseId}-${study.modality}`}><BulletList items={study.result.findings} /><p><strong>Modality assessment:</strong> {study.result.assessment}</p></ReportBlock>)}{isMultimodal && result.concordance && <ReportBlock title="Cross-modal concordance / discordance"><p>{result.concordance === "Discordance Detected" ? "Cross-Modal Discordance Detected" : result.concordance}</p><BulletList items={[...(result.complementaryFindings ?? []), ...(result.conflictingFindings ?? [])]} /></ReportBlock>}<ReportBlock title={isMultimodal ? "Integrated assessment" : "Suggested assessment"}><p className="assessment-line">{result.assessment}</p></ReportBlock><div className="report-two-col"><ReportBlock title="Differential diagnoses"><BulletList items={result.differentials.slice(0, 2)} /></ReportBlock><ReportBlock title="Confidence"><p>{result.confidence} <small>Curated qualitative demonstration value; not a validated probability.</small></p></ReportBlock></div><ReportBlock title="Supporting findings"><BulletList items={result.supportingFeatures} /></ReportBlock><ReportBlock title="Additional imaging recommendation"><p>{result.additionalImagingRecommendation}</p></ReportBlock>{result.conflictingFindings?.length ? <ReportBlock title="Discordant findings"><BulletList items={result.conflictingFindings} /></ReportBlock> : null}<ReportBlock title="Clinician review"><textarea className="no-print" value={clinicianNote} onChange={(e) => setClinicianNote(e.target.value)} placeholder="Optional clinician note or modification rationale" /><p className="print-only">{report.clinicianNote || "No clinician note entered."}</p><div className="review-controls no-print"><button type="button" className={report.reviewDecision === "Accepted" ? "active accept" : ""} onClick={() => onReview("Accepted")}>Accept</button><button type="button" className={report.reviewDecision === "Modified" ? "active modify" : ""} onClick={() => onReview("Modified")}>Modify</button><button type="button" className={report.reviewDecision === "Rejected" ? "active reject" : ""} onClick={() => onReview("Rejected")}>Reject</button></div></ReportBlock><footer>Generated {new Date(report.generatedAt).toLocaleString()} · Research demonstration only · Not for clinical diagnosis</footer></article></main>;
}

function ReportBlock({ title, children }: { title: string; children: React.ReactNode }) { return <section className="report-block"><h3>{title}</h3>{children}</section>; }
function ReportFacts({ items }: { items: [string, string][] }) { return <dl className="report-facts">{items.map(([term, value]) => <div key={term}><dt>{term}</dt><dd>{value || "Not provided"}</dd></div>)}</dl>; }
function BulletList({ items }: { items: string[] }) { return items.length ? <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Not separately specified.</p>; }
function PageShell({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: React.ReactNode }) { return <main className="page-shell"><header className="page-title"><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{intro}</p></header>{children}</main>; }
function Navigation({ onBack, onNext, nextDisabled, nextLabel }: { onBack: () => void; onNext?: () => void; nextDisabled?: boolean; nextLabel?: string }) { return <div className="page-navigation"><button type="button" className="button button-secondary" onClick={onBack}>Back</button>{onNext && <button type="button" className="button button-primary" disabled={nextDisabled} onClick={onNext}>{nextLabel ?? "Continue"}</button>}</div>; }
