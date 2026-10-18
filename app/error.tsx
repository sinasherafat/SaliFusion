"use client";

export default function ErrorState({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="page-shell"><p className="eyebrow">Viewer error</p><h1>SaliFusion AI could not load this view</h1><p>The selected files have not been uploaded. Retry the current view or start a new analysis.</p><button className="button button-primary" type="button" onClick={reset}>Retry</button></main>;
}
