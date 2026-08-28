"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { DicomSeries } from "@/types/salifusion";
import { configureToolGroup, downloadCanvas, getCornerstoneRuntime } from "@/lib/cornerstone/runtime";

export function CornerstoneStackViewer({ series }: { series: DicomSeries }) {
  const elementRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<import("@cornerstonejs/core").RenderingEngine | null>(null);
  const viewportIdRef = useRef("");
  const reactId = useId().replace(/:/g, "");
  const [status, setStatus] = useState("Initializing local DICOM viewer…");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    const engineId = `stack-engine-${reactId}`;
    const viewportId = `stack-viewport-${reactId}`;
    const toolGroupId = `stack-tools-${reactId}`;
    viewportIdRef.current = viewportId;

    async function mount() {
      if (!elementRef.current) return;
      try {
        setError(null);
        const runtime = await getCornerstoneRuntime();
        if (disposed || !elementRef.current) return;
        setStatus("Reading DICOM pixel data locally…");
        const imageIds = series.instances.map(({ file }, index) => {
          const imageId = runtime.dicom.wadouri.fileManager.add(file);
          series.instances[index].metadata.imageId = imageId;
          return imageId;
        });
        await Promise.all(series.instances.map(({ file }, index) => runtime.dicom.prefetchPart10Instance(imageIds[index], () => file.arrayBuffer())));
        if (disposed || !elementRef.current) return;
        const engine = new runtime.core.RenderingEngine(engineId);
        engineRef.current = engine;
        engine.enableElement({ viewportId, element: elementRef.current, type: runtime.core.Enums.ViewportType.STACK });
        const viewport = engine.getViewport(viewportId) as import("@cornerstonejs/core").StackViewport;
        await viewport.setStack(imageIds);
        configureToolGroup(runtime, toolGroupId, [{ viewportId, renderingEngineId: engineId }]);
        viewport.render();
        setStatus(`${imageIds.length} DICOM image${imageIds.length === 1 ? "" : "s"} ready`);
      } catch (reason) {
        if (!disposed) setError(reason instanceof Error ? reason.message : "The DICOM image could not be displayed.");
      }
    }
    void mount();
    return () => {
      disposed = true;
      void getCornerstoneRuntime().then((runtime) => runtime.tools.ToolGroupManager.destroyToolGroup(toolGroupId));
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, [reactId, series]);

  function reset() {
    const viewport = engineRef.current?.getViewport(viewportIdRef.current);
    viewport?.resetCamera();
    viewport?.render();
  }

  function exportView(format: "png" | "jpeg") {
    const viewport = engineRef.current?.getViewport(viewportIdRef.current);
    if (viewport) downloadCanvas(viewport.getCanvas(), format, "salifusion-current-view");
  }

  return (
    <section className="medical-viewer-shell" aria-label="DICOM image viewer">
      <div className="viewer-toolbar">
        <div className="tool-legend"><span>Left: W/L</span><span>Middle: Pan</span><span>Right: Zoom</span><span>Wheel: Slice</span></div>
        <div className="toolbar-actions">
          <button type="button" onClick={reset}>Reset</button>
          <button type="button" onClick={() => exportView("png")}>Export PNG</button>
          <button type="button" onClick={() => exportView("jpeg")}>Export JPG</button>
        </div>
      </div>
      <div className="cornerstone-host stack-host" ref={elementRef} onContextMenu={(event) => event.preventDefault()} />
      <div className="viewer-status">{error ? <span className="error-text">{error}</span> : status}</div>
    </section>
  );
}
