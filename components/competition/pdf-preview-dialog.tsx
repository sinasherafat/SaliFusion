"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask } from "pdfjs-dist";

export function PdfPreviewDialog({ title, url, fileName, warnings, onClose }: { title: string; url: string; fileName: string; warnings: string[]; onClose: () => void }) {
  const pagesRef = useRef<HTMLDivElement>(null);
  const [renderState, setRenderState] = useState<"rendering" | "ready" | "error">("rendering");
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | undefined;
    const host = pagesRef.current;
    if (!host) return;
    host.replaceChildren();
    setRenderState("rendering");
    setPageCount(0);
    (async () => {
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
        console.error("Unable to render PDF preview", error);
        if (!cancelled) setRenderState("error");
      }
    })();
    return () => { cancelled = true; void loadingTask?.destroy(); host.replaceChildren(); };
  }, [title, url]);

  function download() { const link = document.createElement("a"); link.href = url; link.download = fileName; link.click(); }
  function print() { window.print(); }
  return <div className="pdf-preview-backdrop" role="dialog" aria-modal="true" aria-labelledby="pdf-preview-title">
    <section className="pdf-preview-shell">
      <header><div><span>{renderState === "error" ? "Preview unavailable" : renderState === "ready" ? "Preview Ready" : "Rendering PDF…"}</span><h2 id="pdf-preview-title">{title}</h2><p>{renderState === "ready" ? `${pageCount} client-rendered page${pageCount === 1 ? "" : "s"}.` : "Generated locally from the current browser session."}</p></div><div><button className="secondary" onClick={print} disabled={renderState !== "ready"}>Print</button><button onClick={download}>Download PDF</button><button className="close" aria-label="Close PDF preview" onClick={onClose}>Close</button></div></header>
      {warnings.length ? <div className="pdf-preview-warning">{warnings.join(" ")}</div> : null}
      <div className="pdf-preview-canvas">{renderState === "rendering" && <div className="pdf-preview-message"><strong>Rendering PDF pages…</strong><p>The report stays on this device.</p></div>}{renderState === "error" && <div className="pdf-preview-message error"><strong>Unable to render PDF in this browser.</strong><p>The verified PDF is still available to download.</p><button onClick={download}>Download the verified PDF</button></div>}<div ref={pagesRef} className="pdf-page-stack" data-pdf-url={url} aria-label={`${title} PDF preview`} /></div>
    </section>
  </div>;
}
