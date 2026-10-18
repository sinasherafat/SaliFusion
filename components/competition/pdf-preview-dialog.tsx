"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { PDFDocumentLoadingTask } from "pdfjs-dist";
import type { CompetitionReportInput } from "@/lib/report/competition-pdf";

type ReportKind = CompetitionReportInput["kind"];
export type PdfBuildResult = { bytes: Uint8Array; warnings: string[] };

function usePdfCanvasRenderer(title: string, url: string | null) {
  const pagesRef = useRef<HTMLDivElement>(null);
  const [renderState, setRenderState] = useState<"idle" | "rendering" | "ready" | "error">(url ? "rendering" : "idle");
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | undefined;
    const host = pagesRef.current;
    if (!host) return;
    host.replaceChildren();
    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setPageCount(0);
      if (!url) { setRenderState("idle"); return; }
      setRenderState("rendering");
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        loadingTask = pdfjs.getDocument({ url });
        const document = await loadingTask.promise;
        if (cancelled) return;
        setPageCount(document.numPages);
        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
          if (cancelled) return;
          const page = await document.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = window.document.createElement("canvas");
          const context = canvas.getContext("2d", { alpha: false });
          if (!context) throw new Error("Canvas rendering is unavailable");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          canvas.dataset.pageNumber = String(pageNumber);
          canvas.setAttribute("aria-label", `${title}, page ${pageNumber} of ${document.numPages}`);
          host.append(canvas);
          await page.render({ canvas, canvasContext: context, viewport }).promise;
        }
        if (!cancelled) setRenderState("ready");
      } catch (error) {
        if (cancelled || (error instanceof Error && error.name === "RenderingCancelledException")) return;
        console.error("Unable to render PDF preview", error);
        setRenderState("error");
      }
    })();
    return () => { cancelled = true; void loadingTask?.destroy(); host.replaceChildren(); };
  }, [title, url]);

  return { pagesRef, renderState, pageCount };
}

function downloadPdf(url: string, fileName: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
}

function printPdf(url: string) {
  const frame = document.createElement("iframe");
  frame.hidden = true;
  frame.src = url;
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 1_000);
  };
  document.body.append(frame);
}

function PdfPages({ title, url, warnings, inline = false, onRetry }: { title: string; url: string | null; warnings: string[]; inline?: boolean; onRetry?: () => void }) {
  const { pagesRef, renderState, pageCount } = usePdfCanvasRenderer(title, url);
  return <>
    {warnings.length ? <div className="pdf-preview-warning">{warnings.join(" ")}</div> : null}
    <div className={inline ? "pdf-preview-canvas inline" : "pdf-preview-canvas"}>
      {(renderState === "idle" || renderState === "rendering") && <div className="pdf-preview-message" role="status"><strong>{renderState === "idle" ? "Preparing professional PDF…" : "Rendering PDF pages…"}</strong><p>The report stays on this device.</p></div>}
      {renderState === "error" && <div className="pdf-preview-message error" role="alert"><strong>Unable to display the PDF in this browser.</strong><p>The report can be regenerated without reloading the clinical video.</p>{onRetry ? <button onClick={onRetry}>Try Again</button> : null}</div>}
      <div ref={pagesRef} className="pdf-page-stack" data-pdf-url={url ?? undefined} data-page-count={pageCount || undefined} aria-label={`${title} PDF preview`} />
    </div>
  </>;
}

export function InlinePdfDocument({ kind, title, sourceKey, buildPdf, onFullscreen, onDownload, fullscreenLabel = "View Fullscreen", downloadLabel = "Download PDF", printLabel = "Print PDF" }: { kind: ReportKind; title: string; sourceKey: string; buildPdf: (kind: ReportKind) => Promise<PdfBuildResult>; onFullscreen: (kind: ReportKind) => void; onDownload: (kind: ReportKind) => void; fullscreenLabel?: string; downloadLabel?: string; printLabel?: string }) {
  const [source, setSource] = useState<{ url: string; warnings: string[] } | null>(null);
  const [generationState, setGenerationState] = useState<"generating" | "ready" | "error">("generating");
  const [retry, setRetry] = useState(0);
  const generatePdf = useEffectEvent((reportKind: ReportKind) => buildPdf(reportKind));

  useEffect(() => {
    let cancelled = false;
    let nextUrl: string | null = null;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      setSource(null);
      setGenerationState("generating");
      void generatePdf(kind).then(({ bytes, warnings }) => {
        nextUrl = URL.createObjectURL(new Blob([Uint8Array.from(bytes).buffer], { type: "application/pdf" }));
        if (cancelled) { URL.revokeObjectURL(nextUrl); return; }
        setSource({ url: nextUrl, warnings });
        setGenerationState("ready");
      }).catch((error) => {
        if (cancelled) return;
        console.error("Unable to generate inline PDF", error);
        setGenerationState("error");
      });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [kind, retry, sourceKey]);

  return <section className="inline-pdf-document" aria-label={`${title} inline PDF`}>
    <header className="inline-pdf-toolbar"><div><span>{generationState === "ready" ? "Professional PDF ready" : generationState === "error" ? "PDF generation failed" : "Generating professional PDF…"}</span><h2>{title}</h2><p>The actual SaliFusion PDF is rendered locally from the current browser-only media and report state.</p></div><div><button onClick={() => onFullscreen(kind)} disabled={generationState !== "ready"}>{fullscreenLabel}</button><button onClick={() => onDownload(kind)} disabled={generationState !== "ready"}>{downloadLabel}</button><button className="secondary" onClick={() => source && printPdf(source.url)} disabled={!source}>{printLabel}</button></div></header>
    {generationState === "error" ? <div className="pdf-preview-message error" role="alert"><strong>Unable to generate the professional PDF.</strong><p>The imported video remains available in this browser.</p><button onClick={() => setRetry((value) => value + 1)}>Try Again</button></div> : <PdfPages title={title} url={source?.url ?? null} warnings={source?.warnings ?? []} inline onRetry={() => setRetry((value) => value + 1)} />}
  </section>;
}

export function PdfPreviewDialog({ title, url, fileName, warnings, onClose }: { title: string; url: string; fileName: string; warnings: string[]; onClose: () => void }) {
  return <div className="pdf-preview-backdrop" role="dialog" aria-modal="true" aria-labelledby="pdf-preview-title"><section className="pdf-preview-shell"><header><div><span>Preview Ready · Fullscreen professional PDF</span><h2 id="pdf-preview-title">{title}</h2><p>Generated locally from the current browser session.</p></div><div><button className="secondary" onClick={() => printPdf(url)}>Print</button><button onClick={() => downloadPdf(url, fileName)}>Download PDF</button><button className="close" aria-label="Close PDF preview" onClick={onClose}>Close</button></div></header><PdfPages title={title} url={url} warnings={warnings} /></section></div>;
}
