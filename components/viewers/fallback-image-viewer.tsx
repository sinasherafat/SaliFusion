"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

export interface FallbackImage { src: string; alt: string; name: string; objectUrl?: boolean }

export function FallbackImageViewer({ images }: { images: FallbackImage[] }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const current = images[Math.min(index, images.length - 1)];
  const count = images.length;

  const label = useMemo(() => count > 1 ? `${index + 1} / ${count}` : "Single image", [count, index]);
  if (!current) return <div className="empty-viewer">No image selected.</div>;

  function exportImage(format: "png" | "jpeg") {
    const source = document.querySelector<HTMLImageElement>(`img[data-fallback-name="${CSS.escape(current.name)}"]`);
    if (!source) return;
    const canvas = document.createElement("canvas"); canvas.width = source.naturalWidth; canvas.height = source.naturalHeight;
    canvas.getContext("2d")?.drawImage(source, 0, 0);
    const anchor = document.createElement("a"); anchor.download = `salifusion-current-view.${format === "jpeg" ? "jpg" : "png"}`; anchor.href = canvas.toDataURL(`image/${format}`, 0.94); anchor.click();
  }

  return (
    <section className="medical-viewer-shell">
      <div className="viewer-toolbar">
        <div className="toolbar-actions"><button type="button" onClick={() => setZoom((value) => Math.max(0.5, value - 0.2))}>Zoom −</button><button type="button" onClick={() => setZoom((value) => Math.min(4, value + 0.2))}>Zoom +</button><button type="button" onClick={() => setZoom(1)}>Reset</button><button type="button" onClick={() => exportImage("png")}>Export PNG</button><button type="button" onClick={() => exportImage("jpeg")}>Export JPG</button></div>
      </div>
      <div className="fallback-stage">
        <Image data-fallback-name={current.name} src={current.src} alt={current.alt} width={960} height={720} unoptimized={current.objectUrl} style={{ transform: `scale(${zoom})` }} />
      </div>
      <div className="image-navigation"><button type="button" disabled={index === 0} onClick={() => { setIndex((value) => value - 1); setZoom(1); }}>Previous</button><span>{current.name} · {label}</span><button type="button" disabled={index >= count - 1} onClick={() => { setIndex((value) => value + 1); setZoom(1); }}>Next</button></div>
    </section>
  );
}
