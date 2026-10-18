"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { DicomSeries } from "@/types/salifusion";
import { configureToolGroup, downloadCanvas, getCornerstoneRuntime } from "@/lib/cornerstone/runtime";

const labels = ["Axial", "Coronal", "Sagittal"] as const;

export function CornerstoneMprViewer({ series }: { series: DicomSeries }) {
  const elements = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const engineRef = useRef<import("@cornerstonejs/core").RenderingEngine | null>(null);
  const idsRef = useRef<string[]>([]);
  const reactId = useId().replace(/:/g, "");
  const [status, setStatus] = useState("Preparing DICOM volume…");
  const [error, setError] = useState<string | null>(null);
  const [activeViewport, setActiveViewport] = useState(0);

  useEffect(() => {
    let disposed = false;
    const engineId = `mpr-engine-${reactId}`;
    const toolGroupId = `mpr-tools-${reactId}`;
    const viewportIds = labels.map((label) => `mpr-${label.toLowerCase()}-${reactId}`);
    idsRef.current = viewportIds;
    const volumeId = `cornerstoneStreamingImageVolume:salifusion-${reactId}-${Date.now()}`;

    async function mount() {
      if (elements.some((item) => !item.current)) return;
      try {
        if (series.instances.length < 2) throw new Error("A CBCT volume requires at least two DICOM slices.");
        if (!series.spatiallySorted) throw new Error("This series is missing Image Position/Orientation metadata; a reliable MPR volume cannot be created.");
        const runtime = await getCornerstoneRuntime();
        setStatus(`Parsing ${series.instances.length} spatially sorted slices…`);
        const imageIds = series.instances.map(({ file }, index) => {
          const imageId = runtime.dicom.wadouri.fileManager.add(file);
          series.instances[index].metadata.imageId = imageId;
          return imageId;
        });
        await Promise.all(series.instances.map(({ file }, index) => runtime.dicom.prefetchPart10Instance(imageIds[index], () => file.arrayBuffer())));
        if (disposed || elements.some((item) => !item.current)) return;
        setStatus("Creating the real three-dimensional volume…");
        const volume = await runtime.core.volumeLoader.createAndCacheVolume(volumeId, { imageIds });
        const engine = new runtime.core.RenderingEngine(engineId);
        engineRef.current = engine;
        const orientations = [runtime.core.Enums.OrientationAxis.AXIAL, runtime.core.Enums.OrientationAxis.CORONAL, runtime.core.Enums.OrientationAxis.SAGITTAL];
        engine.setViewports(viewportIds.map((viewportId, index) => ({
          viewportId,
          element: elements[index].current!,
          type: runtime.core.Enums.ViewportType.ORTHOGRAPHIC,
          defaultOptions: { orientation: orientations[index], background: [0.015, 0.025, 0.045] as [number, number, number] },
        })));
        configureToolGroup(runtime, toolGroupId, viewportIds.map((viewportId) => ({ viewportId, renderingEngineId: engineId })));
        volume.load();
        await runtime.core.setVolumesForViewports(engine, [{ volumeId }], viewportIds);
        engine.renderViewports(viewportIds);
        setStatus(`Volume created from ${imageIds.length} spatially sorted slices · MPR ready`);
      } catch (reason) {
        if (!disposed) setError(reason instanceof Error ? reason.message : "The CBCT series could not be converted into a volume.");
      }
    }
    void mount();
    return () => {
      disposed = true;
      void getCornerstoneRuntime().then((runtime) => {
        runtime.tools.ToolGroupManager.destroyToolGroup(toolGroupId);
        if (runtime.core.cache.getVolumeLoadObject(volumeId)) {
          runtime.core.cache.removeVolumeLoadObject(volumeId);
        }
      });
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  // The ref array is intentionally stable for this mounted component.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reactId, series]);

  function reset() {
    for (const viewportId of idsRef.current) {
      const viewport = engineRef.current?.getViewport(viewportId);
      viewport?.resetCamera(); viewport?.render();
    }
  }

  function exportView(format: "png" | "jpeg") {
    const viewport = engineRef.current?.getViewport(idsRef.current[activeViewport]);
    if (viewport) downloadCanvas(viewport.getCanvas(), format, `salifusion-${labels[activeViewport].toLowerCase()}-mpr`);
  }

  return (
    <section className="medical-viewer-shell" aria-label="CBCT multiplanar reconstruction viewer">
      <div className="viewer-toolbar">
        <div className="tool-legend"><span>Left: W/L</span><span>Middle: Pan</span><span>Right: Zoom</span><span>Wheel: Slice</span></div>
        <div className="toolbar-actions"><button type="button" onClick={reset}>Reset all</button><button type="button" onClick={() => exportView("png")}>Export PNG</button><button type="button" onClick={() => exportView("jpeg")}>Export JPG</button></div>
      </div>
      <div className="mpr-grid">
        {labels.map((label, index) => (
          <div className={`mpr-panel ${activeViewport === index ? "active" : ""}`} key={label} onClick={() => setActiveViewport(index)}>
            <span className="viewport-label">{label}</span>
            <div className="cornerstone-host" ref={elements[index]} onContextMenu={(event) => event.preventDefault()} />
          </div>
        ))}
      </div>
      <div className="viewer-status">{error ? <span className="error-text">{error}</span> : status}</div>
    </section>
  );
}
