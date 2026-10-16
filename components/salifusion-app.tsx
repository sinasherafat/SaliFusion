"use client";

import Image from "next/image";
import { useState } from "react";
import { COMPETITION_CASES, getCompetitionCase } from "@/data/competition-cases";
import { mediaSlotsForCase } from "@/data/demo-media";
import { HistoryStep } from "@/components/competition/history-step";
import { ImagingStep } from "@/components/competition/imaging-step";
import { FinalReportStep, FusionStep, ModalityReportsStep } from "@/components/competition/report-steps";
import { createCompetitionPdf, type CompetitionReportInput } from "@/lib/report/competition-pdf";
import { collectReportMedia } from "@/lib/report/browser-media";
import type { CaseId, CaseSession, ClinicalModality, CompetitionCase, GlandExam, WorkflowStep } from "@/types/competition";
import { WORKFLOW_STEPS } from "@/types/competition";

type Screen = "landing" | "cases" | "workflow";

function makeExam(demoCase: CompetitionCase, side: "left" | "right", suffix = "primary"): GlandExam {
  return { id: `${demoCase.id}-${side}-${suffix}`, gland: demoCase.history.gland, side, reviewed: {}, clinicianVerified: {}, ultrasoundUploads: {}, phaseUploads: {}, cbctImages: [], dicomSeries: [], selectedSeriesUid: "", dicomError: "" };
}

function createSession(demoCase: CompetitionCase): CaseSession {
  const primarySide = demoCase.history.laterality === "right" ? "right" : "left";
  const exams = [makeExam(demoCase, primarySide)];
  if (demoCase.history.laterality === "bilateral" || demoCase.id === "case-02") exams.push(makeExam(demoCase, primarySide === "left" ? "right" : "left", "comparison"));
  return { history: structuredClone(demoCase.history), step: "history", exams, activeExamId: exams[0].id, activeModality: demoCase.id === "case-04" ? "sialography" : "ultrasound", selectedMediaSlot: mediaSlotsForCase(demoCase.id)[0].id, comparisonMode: false, fusionGenerated: false, clinicianObservations: {} };
}

function initialSessions(): Record<CaseId, CaseSession> {
  return Object.fromEntries(COMPETITION_CASES.map((demoCase) => [demoCase.id, createSession(demoCase)])) as Record<CaseId, CaseSession>;
}

export function SaliFusionApp() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [identity, setIdentity] = useState({ name: "Competition Reviewer", role: "Clinician / judge" });
  const [activeCaseId, setActiveCaseId] = useState<CaseId>("case-01");
  const [sessions, setSessions] = useState<Record<CaseId, CaseSession>>(initialSessions);
  const demoCase = getCompetitionCase(activeCaseId)!;
  const session = sessions[activeCaseId];
  const exam = session.exams.find((item) => item.id === session.activeExamId) ?? session.exams[0];
  const stepIndex = WORKFLOW_STEPS.findIndex((item) => item.id === session.step);

  const updateSession = (next: CaseSession) => setSessions((current) => ({ ...current, [activeCaseId]: next }));
  const patchSession = (patch: Partial<CaseSession>) => updateSession({ ...session, ...patch });
  const updateExam = (next: GlandExam) => updateSession({ ...session, exams: session.exams.map((item) => item.id === next.id ? next : item) });
  function enterDemo(event: React.FormEvent) { event.preventDefault(); setScreen("cases"); }
  function startCase(caseId: CaseId) { setActiveCaseId(caseId); setScreen("workflow"); }
  function resetCase(caseId: CaseId) { const selected = getCompetitionCase(caseId)!; sessions[caseId].exams.forEach(revokeExam); setSessions((current) => ({ ...current, [caseId]: createSession(selected) })); }
  function goTo(step: WorkflowStep) { patchSession({ step }); }
  function move(direction: -1 | 1) { const nextIndex = Math.max(0, Math.min(WORKFLOW_STEPS.length - 1, stepIndex + direction)); goTo(WORKFLOW_STEPS[nextIndex].id); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function addExam() { const nextSide = exam.side === "left" ? "right" : "left"; const next = makeExam(demoCase, nextSide, `added-${Date.now()}`); updateSession({ ...session, exams: [...session.exams, next], activeExamId: next.id }); }
  function removeExam() { if (session.exams.length === 1 || !window.confirm(`Remove the ${exam.side} ${exam.gland} examination and its local uploads?`)) return; revokeExam(exam); const remaining = session.exams.filter((item) => item.id !== exam.id); updateSession({ ...session, exams: remaining, activeExamId: remaining[0].id, fusionGenerated: false }); }
  function openImaging(modality: ClinicalModality) { patchSession({ step: "imaging", activeModality: modality }); }
  async function download(kind: CompetitionReportInput["kind"]) { const included = (["ultrasound", "sialography", "cbct"] as ClinicalModality[]).filter((modality) => exam.reviewed[modality]); const { media, warnings } = await collectReportMedia({ kind, demoCase, session, exam, includedModalities: included }); if (warnings.length) console.warn("Report media warnings", warnings); const bytes = createCompetitionPdf({ kind, demoCase, history: session.history, exam, includedModalities: included, scores: demoCase.scores, media }); const url = URL.createObjectURL(new Blob([Uint8Array.from(bytes).buffer], { type: "application/pdf" })); const link = document.createElement("a"); link.href = url; link.download = `SaliFusion-${demoCase.id}-${kind}.pdf`; link.click(); globalThis.setTimeout(() => URL.revokeObjectURL(url), 1500); }

  if (screen === "landing") return <Landing identity={identity} onIdentity={setIdentity} onEnter={enterDemo} />;
  if (screen === "cases") return <CaseSelection sessions={sessions} identity={identity} onStart={startCase} onReset={resetCase} onHome={() => setScreen("landing")} />;

  return <div className="clinical-app">
    <header className="app-header"><button className="brand-button" onClick={() => setScreen("cases")}><Brand /></button><div className="case-identity"><span>Case {demoCase.number}</span><strong>{demoCase.shortTitle}</strong></div><div className="header-actions"><span>{identity.name} · demo</span><button onClick={() => setScreen("cases")}>All cases</button></div></header>
    <nav className="progress-nav" aria-label="Case workflow">{WORKFLOW_STEPS.map((item, index) => <button key={item.id} className={session.step === item.id ? "active" : index < stepIndex ? "complete" : ""} onClick={() => goTo(item.id)}><i>{index < stepIndex ? "✓" : item.number}</i><span>{item.label}</span></button>)}</nav>
    <main className="workflow-main">
      {session.step === "history" && <HistoryStep demoCase={demoCase} history={session.history} onChange={(history) => updateSession({ ...session, history, exams: session.exams.map((item, index) => index === 0 ? { ...item, gland: history.gland, side: history.laterality === "right" ? "right" : "left" } : item) })} />}
      {session.step === "imaging" && <ImagingStep demoCase={demoCase} session={session} exam={exam} onSession={updateSession} onExam={updateExam} onAddExam={addExam} onRemoveExam={removeExam} />}
      {session.step === "reports" && <ModalityReportsStep demoCase={demoCase} exam={exam} onDownload={download} onOpenImaging={openImaging} />}
      {session.step === "fusion" && <FusionStep demoCase={demoCase} session={session} exam={exam} onGenerate={() => patchSession({ fusionGenerated: true })} onDownload={() => download("fusion")} />}
      {session.step === "final" && <FinalReportStep demoCase={demoCase} session={session} exam={exam} onDownload={download} />}
    </main>
    <footer className="workflow-footer"><div>{stepIndex > 0 && <button className="back-button" onClick={() => move(-1)}>← Back</button>}</div><span>Case data is isolated in this browser session.</span><div>{stepIndex < WORKFLOW_STEPS.length - 1 ? <button className="continue-button" onClick={() => move(1)}>Continue to {WORKFLOW_STEPS[stepIndex + 1].label} →</button> : <button className="continue-button" onClick={() => setScreen("cases")}>Finish case</button>}</div></footer>
  </div>;
}

function revokeExam(exam: GlandExam) { Object.values(exam.ultrasoundUploads).forEach((item) => { if (item?.objectUrl) URL.revokeObjectURL(item.url); }); Object.values(exam.phaseUploads).forEach((item) => { if (item?.objectUrl) URL.revokeObjectURL(item.url); }); exam.cbctImages.forEach((item) => { if (item.objectUrl) URL.revokeObjectURL(item.url); }); }

function Landing({ identity, onIdentity, onEnter }: { identity: { name: string; role: string }; onIdentity: (identity: { name: string; role: string }) => void; onEnter: (event: React.FormEvent) => void }) {
  return <main className="landing-page"><header className="landing-header"><Brand /><span>Educational decision-support demonstration</span></header><section className="landing-hero"><div className="hero-copy"><span className="eyebrow">Multimodal salivary imaging</span><h1><strong>SaliFusion</strong>Intelligent Salivary<br />Gland Imaging</h1><p>An equipment-integrated, multimodal AI decision-support demonstration combining ultrasound, 2D sialography, and 3D CBCT sialography.</p><form className="demo-entry" onSubmit={onEnter}><div><span>Demo entry</span><b>No clinical authentication is configured</b></div><label>Your demo name<input aria-label="Demo name" required value={identity.name} onChange={(event) => onIdentity({ ...identity, name: event.target.value })} /></label><label>Role<select aria-label="Demo role" value={identity.role} onChange={(event) => onIdentity({ ...identity, role: event.target.value })}><option>Clinician / judge</option><option>Radiologist</option><option>Researcher</option><option>Educator</option></select></label><button type="submit">Enter Clinical Demo <span>→</span></button><small>De-identified fixtures · local file review · educational use only</small></form></div><div className="hero-visual"><Image src="/salifusion-physician-hero.png" alt="Physician reviewing salivary ultrasound and ductal imaging at a bright clinical workstation" width={1536} height={1024} priority /><div className="hero-caption"><span>01</span><p><b>Clinical reasoning, made visible.</b>Five guided journeys from history to independent imaging review and transparent fusion.</p></div></div></section><footer className="landing-footer"><span>Ultrasound replay</span><span>Four-phase sialography</span><span>True DICOM MPR</span><span>Structured PDF reports</span></footer></main>;
}

function CaseSelection({ sessions, identity, onStart, onReset, onHome }: { sessions: Record<CaseId, CaseSession>; identity: { name: string; role: string }; onStart: (id: CaseId) => void; onReset: (id: CaseId) => void; onHome: () => void }) {
  return <main className="case-selection"><header><button className="brand-button" onClick={onHome}><Brand /></button><div><span>{identity.name}</span><small>{identity.role} · educational session</small></div></header><section className="selection-intro"><span className="section-kicker">Competition demonstration</span><h1>Choose a clinical journey</h1><p>Five focused cases. Each preserves its own history, media, findings, and reports while you move between them.</p></section><div className="case-grid">{COMPETITION_CASES.map((demoCase) => { const session = sessions[demoCase.id]; const touched = session.step !== "history" || Object.keys(session.exams[0].reviewed).length > 0; return <article className="case-card" key={demoCase.id} style={{ "--case-accent": demoCase.accent } as React.CSSProperties}><header><span>Case {demoCase.number}</span><i>{demoCase.badge}</i></header><h2>{demoCase.title}</h2><p>{demoCase.objective}</p><div className="case-route"><span>History</span><i /> <span>Imaging</span><i /> <span>Reports</span></div><div className="case-actions"><button onClick={() => onStart(demoCase.id)}>{touched ? `Continue at ${WORKFLOW_STEPS.find((item) => item.id === session.step)?.label}` : "Start Case"} <span>→</span></button>{touched && <button className="restart" onClick={() => { if (window.confirm(`Restart Case ${demoCase.number}? Local inputs for this case will be cleared.`)) onReset(demoCase.id); }}>Restart Case</button>}</div></article>; })}</div><aside className="selection-note"><b>Scientific responsibility built in</b><p>Preset findings stay labeled as educational references until supporting media is supplied and reviewed. Illustrative scores are never presented as validated probabilities.</p></aside></main>;
}

function Brand() { return <span className="brand"><span className="brand-mark">SF</span><span><b>SaliFusion</b><small>Clinical imaging intelligence</small></span></span>; }
