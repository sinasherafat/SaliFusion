"use client";

type CoreModule = typeof import("@cornerstonejs/core");
type DicomModule = typeof import("@cornerstonejs/dicom-image-loader");
type ToolsModule = typeof import("@cornerstonejs/tools");

export interface CornerstoneRuntime { core: CoreModule; dicom: DicomModule; tools: ToolsModule }

let runtimePromise: Promise<CornerstoneRuntime> | null = null;
let toolsRegistered = false;

export function getCornerstoneRuntime() {
  if (!runtimePromise) {
    runtimePromise = Promise.all([
      import("@cornerstonejs/core"),
      import("@cornerstonejs/dicom-image-loader"),
      import("@cornerstonejs/tools"),
    ]).then(async ([core, dicom, tools]) => {
      await core.init();
      dicom.init({ maxWebWorkers: Math.max(1, Math.min(4, navigator.hardwareConcurrency || 1)) });
      await tools.init();
      if (!toolsRegistered) {
        for (const tool of [tools.WindowLevelTool, tools.PanTool, tools.ZoomTool, tools.StackScrollTool]) {
          try { tools.addTool(tool); } catch { /* Tool may already be registered after hot reload. */ }
        }
        toolsRegistered = true;
      }
      return { core, dicom, tools };
    });
  }
  return runtimePromise;
}

export function configureToolGroup(runtime: CornerstoneRuntime, toolGroupId: string, viewports: { viewportId: string; renderingEngineId: string }[]) {
  const { tools } = runtime;
  tools.ToolGroupManager.destroyToolGroup(toolGroupId);
  const group = tools.ToolGroupManager.createToolGroup(toolGroupId);
  if (!group) throw new Error("Unable to initialize medical viewer controls.");
  for (const tool of [tools.WindowLevelTool, tools.PanTool, tools.ZoomTool, tools.StackScrollTool]) group.addTool(tool.toolName);
  for (const viewport of viewports) group.addViewport(viewport.viewportId, viewport.renderingEngineId);
  group.setToolActive(tools.WindowLevelTool.toolName, { bindings: [{ mouseButton: tools.Enums.MouseBindings.Primary }] });
  group.setToolActive(tools.PanTool.toolName, { bindings: [{ mouseButton: tools.Enums.MouseBindings.Auxiliary }] });
  group.setToolActive(tools.ZoomTool.toolName, { bindings: [{ mouseButton: tools.Enums.MouseBindings.Secondary }] });
  group.setToolActive(tools.StackScrollTool.toolName, { bindings: [{ mouseButton: tools.Enums.MouseBindings.Wheel }] });
  return group;
}

export function downloadCanvas(canvas: HTMLCanvasElement, format: "png" | "jpeg", name: string) {
  const anchor = document.createElement("a");
  anchor.download = `${name}.${format === "jpeg" ? "jpg" : "png"}`;
  anchor.href = canvas.toDataURL(`image/${format}`, 0.94);
  anchor.click();
}
