"use client";

import { historyCompleteness } from "@/lib/clinical/competition-rules";
import type { CompetitionCase, HistoryAnswers, TriState } from "@/types/competition";

const triOptions: { value: TriState; label: string }[] = [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "unknown", label: "Unknown" }];

type TriKey = { [K in keyof HistoryAnswers]: HistoryAnswers[K] extends TriState ? K : never }[keyof HistoryAnswers];

const groups: { title: string; description: string; questions: { key: TriKey; label: string }[] }[] = [
  { title: "Primary symptoms", description: "Characterize the current glandular complaint.", questions: [
    { key: "pain", label: "Pain present" }, { key: "mealPain", label: "Pain during meals" }, { key: "mealSwelling", label: "Swelling during meals" }, { key: "recurrentSwelling", label: "Recurrent glandular swelling" },
    { key: "xerostomia", label: "Xerostomia" }, { key: "xerophthalmia", label: "Xerophthalmia" }, { key: "thickMucous", label: "Thick mucous discharge" }, { key: "purulentDischarge", label: "Purulent ductal discharge" },
    { key: "fever", label: "Fever" }, { key: "rednessWarmth", label: "Redness or local warmth" }, { key: "suddenSwelling", label: "Sudden swelling" }, { key: "palpableMass", label: "Palpable mass" },
    { key: "dysphagia", label: "Dysphagia" }, { key: "trismus", label: "Trismus" }, { key: "facialWeakness", label: "Facial weakness" },
  ] },
  { title: "Previous medical history", description: "Record risk factors without assuming that unmentioned items are absent.", questions: [
    { key: "priorStones", label: "Previous salivary stones or obstruction" }, { key: "priorProcedure", label: "Previous sialendoscopy or salivary surgery" }, { key: "autoimmuneDisease", label: "Autoimmune disease or relevant serology" },
    { key: "familyAutoimmune", label: "Family history of autoimmune disorders" }, { key: "childhoodParotitis", label: "Childhood recurrent parotitis" }, { key: "viralParotitis", label: "Previous viral parotitis" },
    { key: "radiotherapy", label: "Head and neck radiotherapy" }, { key: "radioiodine", label: "Radioiodine or relevant thyroid treatment" }, { key: "thyroidDisorder", label: "Thyroid disorder" },
    { key: "antihypertensiveUse", label: "Antihypertensive medication use" }, { key: "xerogenicMedications", label: "Other xerogenic medications" },
  ] },
];

export function HistoryStep({ demoCase, history, onChange }: { demoCase: CompetitionCase; history: HistoryAnswers; onChange: (history: HistoryAnswers) => void }) {
  const completeness = historyCompleteness(history);
  const update = <K extends keyof HistoryAnswers>(key: K, value: HistoryAnswers[K]) => onChange({ ...history, [key]: value });
  return <section className="step-page history-page" data-testid="history-step">
    <header className="page-intro"><div><span className="section-kicker">Structured clinical intake</span><h1>Patient history</h1><p>Preset educational answers are visible and editable. Unknown is retained where the fixture does not define a response.</p></div><div className="completion-ring" aria-label={`${completeness.percent}% core history complete`}><strong>{completeness.percent}%</strong><span>{completeness.completed}/{completeness.total} core</span></div></header>
    <div className="history-section">
      <div className="section-heading"><span>A</span><div><h2>Basic patient information</h2><p>Educational, de-identified case fixture.</p></div></div>
      <div className="field-grid basic-grid">
        <Field label="Patient age"><input aria-label="Patient age" value={history.age} inputMode="numeric" onChange={(event) => update("age", event.target.value)} /></Field>
        <Field label="Sex"><select aria-label="Sex" value={history.sex} onChange={(event) => update("sex", event.target.value as HistoryAnswers["sex"])}><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option><option value="unknown">Unknown</option></select></Field>
        <Field label="Affected gland"><select aria-label="Affected gland" value={history.gland} onChange={(event) => update("gland", event.target.value as HistoryAnswers["gland"])}><option value="parotid">Parotid</option><option value="submandibular">Submandibular</option><option value="sublingual">Sublingual</option><option value="other">Other</option></select></Field>
        <Field label="Laterality"><select aria-label="Laterality" value={history.laterality} onChange={(event) => update("laterality", event.target.value as HistoryAnswers["laterality"])}><option value="left">Left</option><option value="right">Right</option><option value="bilateral">Bilateral</option></select></Field>
        <Field label="Symptom duration"><input aria-label="Symptom duration" value={history.symptomDuration} onChange={(event) => update("symptomDuration", event.target.value)} /></Field>
        <Field label="Onset"><select aria-label="Onset" value={history.onset} onChange={(event) => update("onset", event.target.value as HistoryAnswers["onset"])}><option value="sudden">Sudden</option><option value="gradual">Gradual</option><option value="recurrent">Recurrent</option><option value="unknown">Unknown</option></select></Field>
        <Field label="Swelling pattern"><select aria-label="Swelling pattern" value={history.swellingPattern} onChange={(event) => update("swellingPattern", event.target.value as HistoryAnswers["swellingPattern"])}><option value="persistent">Persistent</option><option value="episodic">Episodic</option><option value="unknown">Unknown</option></select></Field>
      </div>
    </div>
    {groups.map((group, groupIndex) => <div className="history-section" key={group.title}><div className="section-heading"><span>{groupIndex === 0 ? "B" : "C"}</span><div><h2>{group.title}</h2><p>{group.description}</p></div></div><div className="question-list">{group.questions.map((question, index) => <div className="question-row" key={question.key}><div><span>{String(index + 1).padStart(2, "0")}</span><label>{question.label}</label></div><div className="segmented" role="group" aria-label={question.label}>{triOptions.map((option) => <button key={option.value} type="button" className={history[question.key] === option.value ? "selected" : ""} onClick={() => update(question.key, option.value)}>{option.label}</button>)}</div></div>)}</div></div>)}
    <div className="history-section safety-section">
      <div className="section-heading"><span>D</span><div><h2>Contrast and procedural safety</h2><p>Ask about the actual prior reaction and relevant agent—not an imprecise “iodine allergy” label.</p></div></div>
      <div className="question-list">
        <TriQuestion number="01" label="Previous iodinated contrast reaction" value={history.iodinatedContrastReaction} onChange={(value) => update("iodinatedContrastReaction", value)} />
        {history.iodinatedContrastReaction === "yes" && <div className="conditional-field"><Field label="Agent, reaction, and severity"><textarea aria-label="Contrast reaction details" value={history.contrastReactionDetails} onChange={(event) => update("contrastReactionDetails", event.target.value)} placeholder="Describe the actual prior reaction and its severity." /></Field></div>}
        <TriQuestion number="02" label="Previous sialography reaction" value={history.priorSialographyReaction} onChange={(value) => update("priorSialographyReaction", value)} />
        <TriQuestion number="03" label="Current acute suppurative infection concern" value={history.acuteSuppurativeConcern} onChange={(value) => update("acuteSuppurativeConcern", value)} />
        <TriQuestion number="04" label="Suspected impacted distal ductal stone" value={history.impactedDistalStone} onChange={(value) => update("impactedDistalStone", value)} />
      </div>
      <div className="field-grid safety-fields">
        <Field label="Pregnancy status"><select aria-label="Pregnancy status" value={history.pregnancyStatus} onChange={(event) => update("pregnancyStatus", event.target.value as HistoryAnswers["pregnancyStatus"])}><option value="not-applicable">Not applicable</option><option value="not-pregnant">Not pregnant</option><option value="pregnant">Pregnant</option><option value="unknown">Unknown</option></select></Field>
        <Field label="Other procedural precautions"><textarea aria-label="Procedural precautions" value={history.proceduralPrecautions} onChange={(event) => update("proceduralPrecautions", event.target.value)} placeholder="Anticoagulation, access limitations, local protocol…" /></Field>
        <Field label="Clinician notes"><textarea aria-label="Clinician notes" value={history.clinicianNotes} onChange={(event) => update("clinicianNotes", event.target.value)} /></Field>
      </div>
    </div>
    <article className="clinical-summary"><span>Clinical Summary</span><p>{demoCase.clinicalSummary}</p><small>Educational synthesis—not a definitive diagnosis.</small></article>
  </section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }

function TriQuestion({ number, label, value, onChange }: { number: string; label: string; value: TriState; onChange: (value: TriState) => void }) {
  return <div className="question-row"><div><span>{number}</span><label>{label}</label></div><div className="segmented" role="group" aria-label={label}>{triOptions.map((option) => <button key={option.value} type="button" className={value === option.value ? "selected" : ""} onClick={() => onChange(option.value)}>{option.label}</button>)}</div></div>;
}
