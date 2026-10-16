"use client";

import { useRef } from "react";

export function PdfPreviewDialog({ title, url, fileName, warnings, onClose }: { title: string; url: string; fileName: string; warnings: string[]; onClose: () => void }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  function download() { const link = document.createElement("a"); link.href = url; link.download = fileName; link.click(); }
  function print() { try { frameRef.current?.contentWindow?.print(); } catch { download(); } }
  return <div className="pdf-preview-backdrop" role="dialog" aria-modal="true" aria-labelledby="pdf-preview-title">
    <section className="pdf-preview-shell">
      <header><div><span>Preview Ready</span><h2 id="pdf-preview-title">{title}</h2><p>Generated locally from the current browser session.</p></div><div><button className="secondary" onClick={print}>Print</button><button onClick={download}>Download PDF</button><button className="close" aria-label="Close PDF preview" onClick={onClose}>Close</button></div></header>
      {warnings.length ? <div className="pdf-preview-warning">{warnings.join(" ")}</div> : null}
      <div className="pdf-preview-canvas"><iframe ref={frameRef} src={url} title={`${title} PDF preview`} /><div className="pdf-preview-fallback"><strong>Unable to render PDF in this browser?</strong><button onClick={download}>Download the verified PDF</button></div></div>
    </section>
  </div>;
}
