"use client";

import Image from "next/image";
import { lazy, Suspense, useEffect, useState } from "react";
import { DEMO_CASES, findCuratedAsset, getDemoResult } from "@/data/demo-cases";
import { deriveSafetyNotices, recommendImaging } from "@/lib/clinical/recommendation-engine";
import { getCornerstoneRuntime } from "@/lib/cornerstone/runtime";
import { groupDicomSeries } from "@/lib/dicom/parse-dicom";
import { createReportPdf } from "@/lib/report/pdf";
import { serviceForCase } from "@/services/analysis";
import { FusionService } from "@/services/fusion-service";
import { ReportService } from "@/services/report-service";
import type { FallbackImage } from "@/components/viewers/fallback-image-viewer";
import type { AnalysisResult, AnalyzedStudy, DemoAsset, DemoCase, DicomSeries, IntegratedReport, Modality, PatientInfo, ReviewDecision, SialographyPhase } from "@/types/salifusion";
import { patientStudyKey } from "@/types/salifusion";

const StackViewer = lazy(() => import("@/components/viewers/cornerstone-stack-viewer").then((module) => ({ default: module.CornerstoneStackViewer })));
const MprViewer = lazy(() => import("@/components/viewers/cornerstone-mpr-viewer").then((module) => ({ default: module.CornerstoneMprViewer })));
const ImageViewer = lazy(() => import("@/components/viewers/fallback-image-viewer").then((module) => ({ default: module.FallbackImageViewer })));

type WorkspaceSection = "assessment" | Modality | "fusion";
interface UploadState { series: DicomSeries[]; selectedUid: string; fallback: FallbackImage[]; error: string; progress: number; total: number }
const emptyUpload = (): UploadState => ({ series: [], selectedUid: "", fallback: [], error: "", progress: 0, total: 0 });
const emptyUploads = (): Record<Modality, UploadState> => ({ ultrasound: emptyUpload(), sialography_2d: emptyUpload(), cbct_3d: emptyUpload() });
const modalityNames: Record<Modality, string> = { ultrasound: "Ultrasound", sialography_2d: "2D Sialography", cbct_3d: "3D CBCT Sialography" };
const sections: { id: WorkspaceSection; label: string; short: string }[] = [
  { id: "assessment", label: "Patient Assessment", short: "Hx" }, { id: "ultrasound", label: "Ultrasound", short: "US" }, { id: "sialography_2d", label: "2D Sialography", short: "2D" }, { id: "cbct_3d", label: "3D CBCT Sialography", short: "3D" }, { id: "fusion", label: "Multimodal Fusion", short: "FX" },
];
const symptomOptions = ["Recurrent swelling", "Meal-related swelling or pain", "Xerostomia", "Xerophthalmia", "Thick mucous discharge", "Purulent discharge", "Fever / acute infection", "Palpable mass", "Facial nerve symptoms", "Pain", "Swelling"];
const historyOptions = ["Previous salivary stone", "Previous ductal procedure", "Recurrent childhood parotitis", "Autoimmune disorder / serology", "Head and neck radiotherapy", "Radioiodine treatment", "Thyroid disease / treatment", "Diabetes / immunocompromise", "Other relevant risk factor"];
const allPhases: SialographyPhase[] = ["Precontrast", "Ductal filling", "Acinar / parenchymal filling", "Evacuation"];
const competitionSteps = ["Patient presentation", "Review initial ultrasound", "Recognize unresolved obstruction", "Open independent ductal pathway", "Analyze ductal phases", "Automatic cross-modal fusion", "Generate structured report"];

export function SaliFusionApp() {
  const [screen, setScreen] = useState<"welcome" | "workspace" | "report">("welcome");
  const [active, setActive] = useState<WorkspaceSection>("assessment");
  const [demoCase, setDemoCase] = useState<DemoCase>(DEMO_CASES[2]);
  const [patient, setPatient] = useState<PatientInfo>(DEMO_CASES[2].patient);
  const [studies, setStudies] = useState<AnalyzedStudy[]>([]);
  const [fusion, setFusion] = useState<AnalysisResult | null>(null);
  const [uploads, setUploads] = useState<Record<Modality, UploadState>>(emptyUploads);
  const [analyzing, setAnalyzing] = useState<Modality | null>(null);
  const [report, setReport] = useState<IntegratedReport | null>(null);
  const [clinicianNote, setClinicianNote] = useState("");
  const [competitionMode, setCompetitionMode] = useState(false);
  const [competitionStep, setCompetitionStep] = useState(0);
  const [selectedPhase, setSelectedPhase] = useState<SialographyPhase>("Ductal filling");

  const activeModality = active === "ultrasound" || active === "sialography_2d" || active === "cbct_3d" ? active : null;
  const activeStudy = activeModality ? studies.find((study) => study.modality === activeModality) : null;
  const activeResult = active === "fusion" ? fusion : activeStudy?.result ?? null;
  const safetyNotices = deriveSafetyNotices(patient);
  const activeAsset = activeModality ? demoCase.assets.find((asset) => asset.modality === activeModality) ?? null : null;

  function revokeUploads(states: Record<Modality, UploadState>) {
    Object.values(states).flatMap((state) => state.fallback).forEach((item) => { if (item.objectUrl) URL.revokeObjectURL(item.src); });
  }

  function chooseCase(next: DemoCase, competition = false) {
    revokeUploads(uploads);
    setDemoCase(next);
    setPatient(next.patient);
    setStudies([]);
    setFusion(null);
    setReport(null);
    setUploads(emptyUploads());
    setActive(competition ? "assessment" : next.initialModality);
    setSelectedPhase("Ductal filling");
    setCompetitionMode(competition);
    setCompetitionStep(0);
    setScreen("workspace");
  }

  function resetAll() {
    revokeUploads(uploads);
    setUploads(emptyUploads());
    setStudies([]);
    setFusion(null);
    setReport(null);
    setCompetitionMode(false);
    setScreen("welcome");
    void getCornerstoneRuntime().then(({ core, dicom }) => { dicom.wadouri.fileManager.purge(); core.cache.purgeCache(); }).catch(() => undefined);
  }

  async function importFiles(modality: Modality, list: FileList | null) {
    if (!list?.length) return;
    const files = Array.from(list).filter((file) => file.size > 0);
    const current = uploads[modality];
    current.fallback.forEach((item) => { if (item.objectUrl) URL.revokeObjectURL(item.src); });
    setUploads((value) => ({ ...value, [modality]: { ...emptyUpload(), total: files.length } }));
    const imageFiles = files.filter((file) => file.type === "image/jpeg" || file.type === "image/png" || /\.(jpe?g|png)$/i.test(file.name));
    if (imageFiles.length === files.length) {
      const recognized = files.length === 1 ? findCuratedAsset(files[0].name, modality) : null;
      if (recognized) chooseCase(recognized.demoCase);
      setUploads((value) => ({ ...value, [modality]: { ...emptyUpload(), fallback: imageFiles.map((file) => ({ src: URL.createObjectURL(file), alt: file.name, name: file.name, objectUrl: true })) } }));
      return;
    }
    try {
      const grouped = await groupDicomSeries(files, (progress, total) => setUploads((value) => ({ ...value, [modality]: { ...value[modality], progress, total } })));
      if (modality === "cbct_3d" && grouped.every((item) => item.instances.length < 2)) throw new Error("No multi-slice DICOM series was found.");
      setUploads((value) => ({ ...value, [modality]: { ...emptyUpload(), series: grouped, selectedUid: grouped[0].uid, progress: files.length, total: files.length } }));
    } catch (reason) {
      setUploads((value) => ({ ...value, [modality]: { ...emptyUpload(), error: reason instanceof Error ? reason.message : "The selected files could not be read." } }));
    }
  }

  async function analyze(modality: Modality) {
    const asset = demoCase.assets.find((item) => item.modality === modality);
    const predefined = getDemoResult(demoCase, modality);
    if (!asset || !predefined) return;
    setAnalyzing(modality);
    try {
      const result = await serviceForCase(demoCase, modality).analyze(demoCase, modality);
      const study: AnalyzedStudy = { caseId: demoCase.id, modality, asset, result, patientKey: patientStudyKey(patient) };
      const next = [...studies.filter((item) => item.modality !== modality), study];
      setStudies(next);
      if (next.length > 1) {
        try { setFusion(new FusionService().combine(next)); } catch { setFusion(null); }
      }
    } finally { setAnalyzing(null); }
  }

  function openReport() {
    const result = fusion ?? activeResult ?? studies.at(-1)?.result;
    if (!result || !studies.length) return;
    setReport(new ReportService().create(patient, studies, result));
    setClinicianNote("");
    setScreen("report");
  }

  function reviewReport(decision: ReviewDecision) {
    if (report) setReport(new ReportService().review(report, decision, clinicianNote));
  }

  function downloadPdf() {
    if (!report) return;
    const bytes = createReportPdf({ ...report, clinicianNote });
    const url = URL.createObjectURL(new Blob([Uint8Array.from(bytes).buffer], { type: "application/pdf" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `SaliFusion-${report.patient.patientId || "report"}.pdf`;
    link.click();
    globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function advanceCompetition() {
    const next = Math.min(competitionStep + 1, competitionSteps.length - 1);
    if (next === 1) setActive("ultrasound");
    if (next === 2) await analyze("ultrasound");
    if (next === 3) setActive("sialography_2d");
    if (next === 4) await analyze("sialography_2d");
    if (next === 5) setActive("fusion");
    if (next === 6) openReport();
    setCompetitionStep(next);
  }

  if (screen === "welcome") return <WelcomeScreen onOpen={() => chooseCase(DEMO_CASES[0])} onCompetition={() => chooseCase(DEMO_CASES[2], true)} onSafety={() => chooseCase(DEMO_CASES[6])} />;
  if (screen === "report" && report) return <ReportScreen report={report} clinicianNote={clinicianNote} setClinicianNote={setClinicianNote} onReview={reviewReport} onBack={() => setScreen("workspace")} onDownload={downloadPdf} onHome={resetAll} />;

  return <div className="workstation">
    <WorkstationHeader active={active} setActive={setActive} fusionReady={Boolean(fusion)} onHome={resetAll} onReport={openReport} reportReady={studies.length > 0} />
    {competitionMode && <CompetitionGuide step={competitionStep} busy={Boolean(analyzing)} onNext={() => void advanceCompetition()} onExit={() => setCompetitionMode(false)} />}
    <div className="workstation-grid">
      <PatientRail patient={patient} setPatient={setPatient} demoCase={demoCase} onCase={(id) => chooseCase(DEMO_CASES.find((item) => item.id === id) ?? demoCase)} safetyNotices={safetyNotices} />
      <main className="imaging-stage">
        <StageHeader active={active} demoCase={demoCase} activeAsset={activeAsset} />
        {active === "assessment" && <AssessmentWorkspace patient={patient} safetyNotices={safetyNotices} onOpen={setActive} />}
        {activeModality && <ModalityWorkspace modality={activeModality} asset={activeAsset} demoCase={demoCase} upload={uploads[activeModality]} setUpload={(next) => setUploads((value) => ({ ...value, [activeModality]: next }))} onImport={(files) => void importFiles(activeModality, files)} result={activeStudy?.result ?? null} analyzing={analyzing === activeModality} onAnalyze={() => void analyze(activeModality)} selectedPhase={selectedPhase} setSelectedPhase={setSelectedPhase} />}
        {active === "fusion" && <FusionWorkspace studies={studies} result={fusion} onOpen={setActive} />}
      </main>
      <DiagnosticRail patient={patient} result={activeResult} safetyNotices={safetyNotices} />
    </div>
    <StudyTimeline studies={studies} active={active} setActive={setActive} result={activeResult} onReport={openReport} />
  </div>;
}

function WelcomeScreen({ onOpen, onCompetition, onSafety }: { onOpen: () => void; onCompetition: () => void; onSafety: () => void }) {
  return <main className="welcome"><header><Brand /><span className="system-pill"><i /> Local workstation · Research demo</span></header><section className="welcome-hero"><div><p className="eyebrow">Equipment-integrated multimodal decision support</p><h1>See the duct.<br /><span>Understand the whole gland.</span></h1><p className="lede">A clinically coherent workstation for independent ultrasound, 2D sialography, genuine CBCT DICOM review, adaptive recommendations, and automatic cross-modal interpretation.</p><div className="welcome-actions"><button className="primary-action" onClick={onCompetition}>Run competition demo <span>→</span></button><button className="secondary-action" onClick={onOpen}>Open workstation</button><button className="ghost-action" onClick={onSafety}>Open safety-stop case</button></div><p className="demo-disclaimer">Deterministic educational demonstration. No clinical validation or autonomous diagnosis is claimed.</p></div><aside className="hero-console"><div className="console-top"><span>DEMO / OCCULT OBSTRUCTION</span><span className="live-dot">GUIDED</span></div><div className="mini-patient"><b>38F · Left parotid</b><span>Recurrent meal-related swelling</span></div><div className="console-flow"><article><em>01</em><div><b>Ultrasound</b><span>No visible calculus</span></div><i className="neutral" /></article><article><em>02</em><div><b>Decision support</b><span>Unresolved ductal question</span></div><i className="warn" /></article><article><em>03</em><div><b>Sialography</b><span>Proximal stenosis mapped</span></div><i className="positive" /></article></div><div className="console-result"><span>AUTOMATIC FUSION</span><strong>Complementary findings resolve the obstruction.</strong></div></aside></section><footer><span>01 Clinical assessment</span><span>02 Independent pathways</span><span>03 Explainable reasoning</span><span>04 Structured report</span></footer></main>;
}

function Brand() { return <div className="brand"><span className="brand-symbol"><i /><i /><i /></span><span><b>SaliFusion</b><small>Clinical imaging intelligence</small></span></div>; }

function WorkstationHeader({ active, setActive, fusionReady, onHome, onReport, reportReady }: { active: WorkspaceSection; setActive: (section: WorkspaceSection) => void; fusionReady: boolean; onHome: () => void; onReport: () => void; reportReady: boolean }) {
  return <header className="workstation-header"><button className="brand-reset" onClick={onHome}><Brand /></button><nav aria-label="Clinical workspaces">{sections.map((section) => <button key={section.id} className={active === section.id ? "active" : ""} onClick={() => setActive(section.id)} disabled={section.id === "fusion" && !fusionReady}><span>{section.short}</span>{section.label}{section.id === "fusion" && fusionReady && <i />}</button>)}</nav><div className="header-tools"><span className="connection-state"><i /> DICOM local</span><button className="report-button" disabled={!reportReady} onClick={onReport}>Structured report</button></div></header>;
}

function CompetitionGuide({ step, busy, onNext, onExit }: { step: number; busy: boolean; onNext: () => void; onExit: () => void }) {
  return <section className="competition-guide"><span className="competition-label">Competition Demo</span><div className="competition-track">{competitionSteps.map((item, index) => <span key={item} className={index === step ? "current" : index < step ? "done" : ""}><i>{index + 1}</i>{item}</span>)}</div><button onClick={onNext} disabled={busy || step === competitionSteps.length - 1}>{busy ? "Analyzing…" : step === competitionSteps.length - 2 ? "Build report" : "Next step"}</button><button className="guide-close" onClick={onExit} aria-label="Exit competition mode">×</button></section>;
}

function PatientRail({ patient, setPatient, demoCase, onCase, safetyNotices }: { patient: PatientInfo; setPatient: (patient: PatientInfo) => void; demoCase: DemoCase; onCase: (id: string) => void; safetyNotices: string[] }) {
  const toggle = (key: "symptoms" | "history", item: string) => setPatient({ ...patient, [key]: patient[key].includes(item) ? patient[key].filter((value) => value !== item) : [...patient[key], item] });
  const update = <K extends keyof PatientInfo>(key: K, value: PatientInfo[K]) => setPatient({ ...patient, [key]: value });
  return <aside className="patient-rail"><div className="rail-heading"><span>Case navigator</span><b>Clinical context</b></div><label className="case-select">Educational case<select value={demoCase.id} onChange={(event) => onCase(event.target.value)}>{DEMO_CASES.map((item, index) => <option key={item.id} value={item.id}>{String(index + 1).padStart(2, "0")} · {item.shortTitle}</option>)}</select></label><div className="patient-identity"><div className="avatar">{patient.sex === "Male" ? "M" : "F"}</div><div><input aria-label="Patient ID" value={patient.patientId} onChange={(event) => update("patientId", event.target.value)} /><span>{patient.age || "–"} years · {patient.sex || "unspecified"}</span></div></div><div className="anatomy-tags"><button className="active">{patient.side || "Side"}</button><button className="active">{patient.gland || "Gland"}</button><select aria-label="Symptom course" value={patient.symptomCourse} onChange={(event) => update("symptomCourse", event.target.value as PatientInfo["symptomCourse"])}><option value="">Course</option><option>Acute</option><option>Chronic</option><option>Recurrent</option></select></div><details open><summary>Presenting features <span>{patient.symptoms.length}</span></summary><div className="clinical-checks">{symptomOptions.map((item) => <label key={item}><input type="checkbox" checked={patient.symptoms.includes(item)} onChange={() => toggle("symptoms", item)} /><span>{item}</span></label>)}</div></details><details><summary>Relevant history <span>{patient.history.length}</span></summary><div className="clinical-checks">{historyOptions.map((item) => <label key={item}><input type="checkbox" checked={patient.history.includes(item)} onChange={() => toggle("history", item)} /><span>{item}</span></label>)}</div></details><details open={patient.symptoms.includes("Xerostomia")}><summary>Medication & serology</summary><label className="compact-field">Xerogenic / relevant medication<textarea value={patient.medications} onChange={(event) => update("medications", event.target.value)} /></label><label className="compact-field">Autoimmune serology<textarea value={patient.serology} onChange={(event) => update("serology", event.target.value)} /></label></details><details open={safetyNotices.length > 0}><summary>Contrast safety {safetyNotices.length > 0 && <i className="alert-dot" />}</summary><label className="compact-field">Reaction history<select value={patient.contrastReaction} onChange={(event) => update("contrastReaction", event.target.value as PatientInfo["contrastReaction"])}><option value="">Select</option><option>None known</option><option>Previous mild reaction</option><option>Previous severe reaction</option><option>Unknown</option></select></label></details><label className="compact-field notes">Clinical note<textarea value={patient.clinicalNotes} onChange={(event) => update("clinicalNotes", event.target.value)} /></label><div className="privacy-lock"><span>⌁</span><div><b>Local data boundary</b><small>Patient files remain in this browser session.</small></div></div></aside>;
}

function StageHeader({ active, demoCase, activeAsset }: { active: WorkspaceSection; demoCase: DemoCase; activeAsset: DemoAsset | null }) {
  const title = sections.find((item) => item.id === active)?.label ?? active;
  return <header className="stage-header"><div><p>{title.toUpperCase()} / {demoCase.patient.side.toUpperCase()} {demoCase.patient.gland.toUpperCase()}</p><h1>{active === "assessment" ? demoCase.title : title}</h1><span>{active === "assessment" ? demoCase.summary : activeAsset?.sourceLabel ?? "Import local imaging for review"}</span></div><div className="stage-status"><span><i className="green" /> De-identified demo</span><span><i /> Measurements illustrative unless DICOM-calibrated</span></div></header>;
}

function AssessmentWorkspace({ patient, safetyNotices, onOpen }: { patient: PatientInfo; safetyNotices: string[]; onOpen: (section: WorkspaceSection) => void }) {
  const recommendations = recommendImaging(patient);
  return <div className="assessment-workspace"><section className="assessment-hero"><div><span className="kicker">Clinical synthesis</span><h2>{patient.symptomCourse || "Unspecified-course"} {patient.gland.toLowerCase()} presentation</h2><p>{patient.clinicalNotes || "Complete the structured history in the left panel."}</p></div><div className="assessment-stat"><span>Selected findings</span><strong>{patient.symptoms.length}</strong><small>{patient.history.length} relevant history item{patient.history.length === 1 ? "" : "s"}</small></div></section>{safetyNotices.map((notice) => <SafetyBanner key={notice} text={notice} />)}<div className="assessment-grid"><section><header><span>Clinical signal</span><b>Presentation features</b></header><ul className="signal-list">{patient.symptoms.map((item) => <li key={item}><i />{item}</li>)}</ul></section><section><header><span>Decision support</span><b>Recommended pathway</b></header>{recommendations.map((item) => <RecommendationCard key={item.modality} item={item} />)}</section></div><section className="pathway-chooser"><header><div><span>Independent imaging pathways</span><b>Start with the clinically indicated modality</b></div><small>No modality is forced to follow another.</small></header><div>{(["ultrasound", "sialography_2d", "cbct_3d"] as Modality[]).map((modality) => <button key={modality} onClick={() => onOpen(modality)}><i>{modality === "ultrasound" ? "US" : modality === "sialography_2d" ? "2D" : "3D"}</i><span><b>{modalityNames[modality]}</b><small>{modality === "ultrasound" ? "Gland, focal lesion, calculus" : modality === "sialography_2d" ? "Duct lumen, branches, phases" : "Spatial duct map and true MPR"}</small></span><em>→</em></button>)}</div></section><IntegrationPanel /></div>;
}

function IntegrationPanel() { return <section className="integration-panel"><header><div><span>Integration architecture</span><b>Connected workstation, not proprietary hardware</b></div><span className="implemented-key">● implemented</span></header><div><article><i className="implemented" /><b>Local DICOM import</b><span>Implemented</span></article><article><i className="implemented" /><b>Cornerstone MPR</b><span>Implemented</span></article><article><i className="simulated" /><b>Ultrasound device</b><span>Simulated replay</span></article><article><i className="planned" /><b>DICOMweb / PACS</b><span>Adapter point</span></article><article><i className="planned" /><b>Vendor SDK</b><span>Future integration</span></article></div></section>;
}

function ModalityWorkspace({ modality, asset, demoCase, upload, setUpload, onImport, result, analyzing, onAnalyze, selectedPhase, setSelectedPhase }: { modality: Modality; asset: DemoAsset | null; demoCase: DemoCase; upload: UploadState; setUpload: (state: UploadState) => void; onImport: (files: FileList | null) => void; result: AnalysisResult | null; analyzing: boolean; onAnalyze: () => void; selectedPhase: SialographyPhase; setSelectedPhase: (phase: SialographyPhase) => void }) {
  const series = upload.series.find((item) => item.uid === upload.selectedUid) ?? upload.series[0] ?? null;
  const predefined = getDemoResult(demoCase, modality);
  const hasImported = Boolean(series || upload.fallback.length);
  const directory = modality === "cbct_3d";
  const directoryProps = directory ? ({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>) : {};
  return <div className="modality-workspace">{modality === "sialography_2d" && <PhaseStrip available={predefined?.phasesAvailable ?? []} selected={selectedPhase} onSelect={setSelectedPhase} />}{predefined?.safetyNotices.map((notice) => <SafetyBanner key={notice} text={notice} />)}<section className="viewer-frame"><div className="viewer-toolbar"><div><button className="tool-active">W/L</button><button>Pan</button><button>Zoom</button><button>Measure</button><button>Reset</button></div><span>{asset ? asset.kind === "synthetic-schematic" ? "SYNTHETIC EDUCATIONAL EXAMPLE" : "CURATED REFERENCE" : "LOCAL STUDY"}</span><label className="import-button">Import {directory ? "DICOM folder" : "images"}<input type="file" multiple accept={directory ? ".dcm,application/dicom" : ".dcm,application/dicom,image/jpeg,image/png,video/mp4"} {...directoryProps} onChange={(event) => onImport(event.target.files)} /></label></div><Suspense fallback={<div className="viewer-empty">Loading imaging runtime…</div>}>{hasImported ? <ImportedViewer modality={modality} upload={upload} series={series} setUpload={setUpload} /> : asset ? <CuratedMedicalViewer asset={asset} modality={modality} /> : <div className="viewer-empty"><b>No {modalityNames[modality]} asset in this case</b><span>Import a local study for image review. Arbitrary uploads do not trigger simulated diagnosis.</span></div>}</Suspense>{asset && <div className="image-provenance"><span>{asset.sourceLabel}</span><span>Aspect ratio preserved · No diagnostic crop</span></div>}</section>{upload.error && <div className="error-banner"><b>Unsupported or unreadable file</b><span>{upload.error}</span></div>}{series && <MetadataPanel series={series} />}{modality === "cbct_3d" && asset && !series && <div className="truth-note"><b>Reference only — not a reconstructed volume</b><span>Import a spatially valid DICOM series above to activate real axial, coronal, and sagittal MPR.</span></div>}<div className="analysis-command"><div><span>{predefined ? "Deterministic case logic available" : "Image review only"}</span><b>{result ? "Analysis complete — review the reasoning panel" : "Ready for clinician-initiated analysis"}</b></div><button onClick={onAnalyze} disabled={!asset || !predefined || analyzing}>{analyzing ? "Analyzing…" : result ? "Run again" : "Analyze curated case"}</button></div></div>;
}

function ImportedViewer({ modality, upload, series, setUpload }: { modality: Modality; upload: UploadState; series: DicomSeries | null; setUpload: (state: UploadState) => void }) {
  return <>{upload.progress > 0 && upload.progress < upload.total && <div className="progress-row"><progress value={upload.progress} max={upload.total} /><span>Reading {upload.progress} / {upload.total}</span></div>}{upload.series.length > 1 && <label className="series-selector">Series<select value={upload.selectedUid} onChange={(event) => setUpload({ ...upload, selectedUid: event.target.value })}>{upload.series.map((item) => <option value={item.uid} key={item.uid}>{item.description} · {item.instances.length} images</option>)}</select></label>}{series?.warning && <div className="warning-banner">{series.warning}</div>}{series && modality === "cbct_3d" && <MprViewer series={series} />}{series && modality !== "cbct_3d" && <StackViewer series={series} />}{upload.fallback.length > 0 && <ImageViewer key={upload.fallback[0].src} images={upload.fallback} />}</>;
}

function CuratedMedicalViewer({ asset, modality }: { asset: DemoAsset; modality: Modality }) {
  return <div className={`curated-medical-viewer ${modality}`}><Image src={asset.src} alt={asset.alt} width={1200} height={800} priority />{modality === "ultrasound" && <CineControls />}{modality === "sialography_2d" && <div className="orientation-marker">R</div>}<div className="viewer-overlay top-left"><span>SALIFUSION · {modalityNames[modality].toUpperCase()}</span><span>DEMO STUDY / DE-IDENTIFIED</span></div><div className="viewer-overlay bottom-right"><span>ZOOM 100%</span><span>W/L AUTO</span></div></div>;
}

function CineControls() {
  const [playing, setPlaying] = useState(false);
  const [frame, setFrame] = useState(18);
  useEffect(() => { if (!playing) return; const id = globalThis.setInterval(() => setFrame((value) => value >= 59 ? 0 : value + 1), 90); return () => globalThis.clearInterval(id); }, [playing]);
  return <div className="cine-controls"><button onClick={() => setPlaying((value) => !value)}>{playing ? "Ⅱ" : "▶"}</button><input aria-label="Cine frame" type="range" min="0" max="59" value={frame} onChange={(event) => setFrame(Number(event.target.value))} /><span>{String(frame + 1).padStart(2, "0")} / 60</span><b>SIMULATED LIVE ULTRASOUND REPLAY</b></div>;
}

function PhaseStrip({ available, selected, onSelect }: { available: SialographyPhase[]; selected: SialographyPhase; onSelect: (phase: SialographyPhase) => void }) {
  return <section className="phase-strip"><div><span>Acquisition phases</span><b>Partial studies are supported</b></div>{allPhases.map((phase, index) => { const present = available.includes(phase); return <button key={phase} className={`${selected === phase ? "selected" : ""} ${present ? "present" : "missing"}`} onClick={() => present && onSelect(phase)} disabled={!present}><i>{index + 1}</i><span>{phase}<small>{present ? "Available" : "Not supplied"}</small></span></button>; })}</section>;
}

function FusionWorkspace({ studies, result, onOpen }: { studies: AnalyzedStudy[]; result: AnalysisResult | null; onOpen: (section: WorkspaceSection) => void }) {
  if (studies.length < 2 || !result) return <div className="fusion-empty"><div className="fusion-orbit"><span>US</span><span>2D</span><span>3D</span></div><h2>Fusion activates automatically</h2><p>Analyze two modalities for the same patient ID, gland, and laterality. No separate “multimodal examination” is required.</p><div>{(["ultrasound", "sialography_2d", "cbct_3d"] as Modality[]).map((item) => <button key={item} onClick={() => onOpen(item)}>{modalityNames[item]}</button>)}</div></div>;
  return <div className="fusion-workspace"><div className="fusion-banner"><span><i /> Automatic fusion active</span><b>{studies.map((study) => modalityNames[study.modality]).join(" + ")}</b><small>Identity, gland, and laterality match confirmed</small></div><div className="fusion-images">{studies.slice(0, 2).map((study) => <figure key={study.modality}><Image src={study.asset.src} alt={study.asset.alt} width={720} height={520} /><figcaption><b>{modalityNames[study.modality]}</b><span>{study.result.observedFindings[0]}</span></figcaption></figure>)}</div><section className="correspondence"><header><span>Anatomical correspondence</span><b>What each modality contributes</b></header><div><article><span>Concordant</span><p>{result.complementaryFindings?.[0] ?? "The reviewed structures are clinically compatible."}</p></article><article><span>Complementary</span><p>{result.complementaryFindings?.[1] ?? "Each modality answers a different part of the diagnostic question."}</p></article><article className={result.conflictingFindings?.length ? "warning" : ""}><span>Discordant</span><p>{result.conflictingFindings?.join(" ") || "No predefined discordance in this paired case."}</p></article><article><span>Missing</span><p>{result.missingEvidence.join(" · ")}</p></article></div></section></div>;
}

function DiagnosticRail({ patient, result, safetyNotices }: { patient: PatientInfo; result: AnalysisResult | null; safetyNotices: string[] }) {
  const recommendations = result?.recommendations ?? recommendImaging(patient, result);
  return <aside className="diagnostic-rail"><div className="rail-heading"><span>Diagnostic reasoning</span><b>Explainable output</b></div>{safetyNotices.map((notice) => <SafetyBanner key={notice} text={notice} compact />)}{result ? <><div className="diagnostic-impression"><span>{result.modality === "multimodal" ? "Integrated assessment" : "Suggested assessment"}</span><b>{result.assessment}</b></div><div className="confidence-row"><span>Illustrative demo confidence</span><b className={result.confidence.toLowerCase()}>{result.confidence}</b><small>Not clinically validated</small></div><ReasoningGroup index="01" title="Observed findings" items={result.observedFindings} /><ReasoningGroup index="02" title="Pattern interpretation" items={result.patternInterpretations} /><ReasoningGroup index="03" title="Differential diagnoses" items={result.differentials} /><ReasoningGroup index="04" title="Missing evidence" items={result.missingEvidence} muted />{result.ductMap?.length ? <section className="duct-map"><header><span>05</span><b>Ductal map</b></header>{result.ductMap.map((item) => <div key={`${item.structure}-${item.location}`}><b>{item.structure}</b><span>{item.location}</span><p>{item.finding}{item.extent ? ` · ${item.extent}` : ""}</p></div>)}</section> : null}</> : <div className="reasoning-empty"><span>◌</span><b>No image interpretation yet</b><p>Clinical recommendations below use the structured history only.</p></div>}<section className="recommendation-group"><header><span>Next-step decision support</span><b>{recommendations.length} recommendation{recommendations.length === 1 ? "" : "s"}</b></header>{recommendations.map((item) => <RecommendationCard key={`${item.modality}-${item.priority}`} item={item} compact />)}</section><div className="clinical-disclaimer"><b>Clinician review required</b><span>Educational deterministic logic; not a medical device or autonomous diagnosis.</span></div></aside>;
}

function ReasoningGroup({ index, title, items, muted }: { index: string; title: string; items: string[]; muted?: boolean }) { return <section className={`reasoning-group ${muted ? "muted" : ""}`}><header><span>{index}</span><b>{title}</b></header>{items.length ? <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p>None listed for this curated result.</p>}</section>; }
function SafetyBanner({ text, compact }: { text: string; compact?: boolean }) { return <div className={`safety-banner ${compact ? "compact" : ""}`}><span>!</span><div><b>Safety notice</b><p>{text}</p></div></div>; }
function RecommendationCard({ item, compact }: { item: AnalysisResult["recommendations"][number]; compact?: boolean }) { return <article className={`recommendation-card ${item.priority.toLowerCase().replaceAll(" ", "-")} ${compact ? "compact" : ""}`}><header><span>{item.priority}</span><b>{item.modality}</b></header><p>{item.rationale}</p>{!compact && <><dl><div><dt>Expected contribution</dt><dd>{item.expectedContribution}</dd></div><div><dt>Safety</dt><dd>{item.safety}</dd></div></dl><small>Alternatives: {item.alternatives.join(" · ")}</small></>}</article>; }

function StudyTimeline({ studies, active, setActive, result, onReport }: { studies: AnalyzedStudy[]; active: WorkspaceSection; setActive: (section: WorkspaceSection) => void; result: AnalysisResult | null; onReport: () => void }) {
  return <footer className="study-timeline"><div className="timeline-title"><span>Study timeline</span><b>{studies.length ? `${studies.length} analyzed acquisition${studies.length > 1 ? "s" : ""}` : "No analyzed imaging"}</b></div><div className="timeline-items">{studies.length ? studies.map((study, index) => <button key={study.modality} className={active === study.modality ? "active" : ""} onClick={() => setActive(study.modality)}><i>{index + 1}</i><span><b>{modalityNames[study.modality]}</b><small>{study.result.assessment}</small></span></button>) : <span className="timeline-empty">Analyze an independent imaging pathway to build the patient timeline.</span>}{studies.length > 1 && <button className={active === "fusion" ? "active fusion" : "fusion"} onClick={() => setActive("fusion")}><i>FX</i><span><b>Automatic fusion</b><small>{result?.concordance ?? "Ready"}</small></span></button>}</div><button className="timeline-report" disabled={!studies.length} onClick={onReport}>Create report <span>→</span></button></footer>;
}

function MetadataPanel({ series }: { series: DicomSeries }) {
  const meta = series.instances[0]?.metadata;
  const rows = [["Series", meta.seriesDescription || "Not provided"], ["Modality", meta.modality || "Not provided"], ["Instances", String(series.instances.length)], ["Dimensions", meta.rows && meta.columns ? `${meta.columns} × ${meta.rows}` : "Not provided"], ["Pixel spacing", meta.pixelSpacing?.join(" × ") || "Not provided"], ["Slice thickness", meta.sliceThickness ? `${meta.sliceThickness} mm` : "Not provided"], ["Spatial sorting", series.spatiallySorted ? "Image Position + Orientation" : "Instance Number fallback"]];
  return <details className="metadata-panel"><summary>DICOM metadata · processed locally</summary><dl>{rows.map(([term, value]) => <div key={term}><dt>{term}</dt><dd>{value}</dd></div>)}</dl></details>;
}

function ReportScreen({ report, clinicianNote, setClinicianNote, onReview, onBack, onDownload, onHome }: { report: IntegratedReport; clinicianNote: string; setClinicianNote: (value: string) => void; onReview: (value: ReviewDecision) => void; onBack: () => void; onDownload: () => void; onHome: () => void }) {
  const { patient, result, studies } = report;
  return <main className="report-page"><div className="report-toolbar no-print"><button onClick={onBack}>← Workstation</button><div><button onClick={() => window.print()}>Print</button><button className="download" onClick={onDownload}>Download PDF</button><button onClick={onHome}>New study</button></div></div><article className="report-sheet"><header><Brand /><div><span>STRUCTURED IMAGING REPORT</span><b className={report.reviewDecision.toLowerCase()}>{report.reviewDecision}</b></div></header><div className="report-warning">Educational deterministic demonstration · Not clinically validated · Clinician review required</div><section className="report-patient"><div><span>Patient</span><b>{patient.patientName}</b></div><div><span>ID</span><b>{patient.patientId}</b></div><div><span>Age / Sex</span><b>{patient.age} / {patient.sex}</b></div><div><span>Site</span><b>{patient.side} {patient.gland}</b></div><div><span>Course</span><b>{patient.symptomCourse}</b></div></section><ReportBlock title="Clinical indication"><p>{report.clinicalInformation.join(" · ")}</p></ReportBlock>{studies.map((study) => <ReportBlock title={`${modalityNames[study.modality]} findings`} key={study.modality}><BulletList items={study.result.observedFindings} />{study.result.phasesAvailable && <p><b>Available phases:</b> {study.result.phasesAvailable.join(", ")}</p>}{study.result.ductMap?.length ? <div className="report-duct-map">{study.result.ductMap.map((item) => <p key={`${item.structure}-${item.location}`}><b>{item.structure} · {item.location}:</b> {item.finding}{item.extent ? ` (${item.extent})` : ""}</p>)}</div> : null}</ReportBlock>)}{result.modality === "multimodal" && <ReportBlock title="Cross-modal fusion"><BulletList items={[...(result.complementaryFindings ?? []), ...(result.conflictingFindings ?? [])]} /></ReportBlock>}<ReportBlock title="Diagnostic impression"><p className="report-impression">{result.assessment}</p><p><b>Differential:</b> {result.differentials.join(" · ") || "None listed"}</p><p><b>Illustrative Demo Confidence — Not Clinically Validated:</b> {result.confidence}</p></ReportBlock><ReportBlock title="Recommendations">{result.recommendations.map((item) => <div className="report-recommendation" key={item.modality}><b>{item.priority} · {item.modality}</b><p>{item.rationale}</p><p><b>Expected contribution:</b> {item.expectedContribution}</p><p><b>Safety:</b> {item.safety}</p><p><b>Alternatives:</b> {item.alternatives.join(", ")}</p></div>)}</ReportBlock>{result.safetyNotices.length > 0 && <ReportBlock title="Contraindication warnings"><BulletList items={result.safetyNotices} /></ReportBlock>}<ReportBlock title="Limitations and uncertainty"><BulletList items={[...result.limitations, ...result.missingEvidence.map((item) => `Missing evidence: ${item}`)]} /></ReportBlock><ReportBlock title="Clinician review"><textarea className="no-print" value={clinicianNote} onChange={(event) => setClinicianNote(event.target.value)} placeholder="Add clinician note or modification rationale" /><p className="print-only">{report.clinicianNote || "No clinician note entered."}</p><div className="review-buttons no-print">{(["Accepted", "Modified", "Rejected"] as ReviewDecision[]).map((decision) => <button key={decision} className={report.reviewDecision === decision ? "active" : ""} onClick={() => onReview(decision)}>{decision.replace("ed", "")}</button>)}</div></ReportBlock><footer>Generated {new Date(report.generatedAt).toLocaleString()} · SaliFusion research demonstration</footer></article></main>;
}

function ReportBlock({ title, children }: { title: string; children: React.ReactNode }) { return <section className="report-block"><h2>{title}</h2>{children}</section>; }
function BulletList({ items }: { items: string[] }) { return items.length ? <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p>None identified in the curated output.</p>; }
