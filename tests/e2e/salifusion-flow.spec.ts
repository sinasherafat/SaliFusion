import { expect, test } from "@playwright/test";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";

async function enterDemo(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Intelligent Salivary/ })).toBeVisible();
  await page.getByRole("button", { name: /Enter Clinical Demo/ }).click();
  await expect(page.getByRole("heading", { name: "Choose a clinical journey" })).toBeVisible();
}

const pixelPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

async function syntheticVideo(page: import("@playwright/test").Page) {
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement("canvas"); canvas.width = 64; canvas.height = 64; const context = canvas.getContext("2d")!; context.fillStyle = "#177f78"; context.fillRect(0, 0, 64, 64);
    const stream = canvas.captureStream(12); const mimeType = "video/webm;codecs=vp8";
    if (!MediaRecorder.isTypeSupported(mimeType)) throw new Error(`${mimeType} is required for the synthetic playback fixture`);
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 250_000 }); const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); }; recorder.start(250);
    for (let frame = 0; frame < 24; frame += 1) { context.fillStyle = frame % 2 ? "#177f78" : "#d7efeb"; context.fillRect(0, 0, 64, 64); context.fillStyle = "#0a2825"; context.fillRect(frame * 2, 22, 8, 20); await new Promise((resolve) => setTimeout(resolve, 80)); }
    const stopped = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); }); recorder.stop(); await stopped;
    return Array.from(new Uint8Array(await new Blob(chunks, { type: mimeType }).arrayBuffer()));
  });
  return Buffer.from(bytes);
}

test("approved landing entry exposes exactly five focused cases and editable history", async ({ page }) => {
  await enterDemo(page);
  await expect(page.locator(".case-card")).toHaveCount(5);
  await page.locator(".case-card").first().getByRole("button", { name: /Start Case/ }).click();
  await expect(page.getByRole("heading", { name: "Patient history" })).toBeVisible();
  await page.getByLabel("Patient age").fill("43");
  await page.getByRole("button", { name: /Continue to Imaging/ }).click();
  await expect(page.getByRole("heading", { name: "Imaging workspace" })).toBeVisible();
  await expect(page.getByText(/Built-in Clinical Demo Media · Ultrasound ready · 4\/4 sialography phases ready/)).toBeVisible();
  await page.getByRole("button", { name: "All cases" }).click();
  await page.locator(".case-card").first().getByRole("button", { name: /Continue at Imaging/ }).click();
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.getByLabel("Patient age")).toHaveValue("43");
});

test("case one preloads the ordered four-phase study and permits a browser-local replacement", async ({ page }) => {
  await enterDemo(page);
  await page.locator(".case-card").first().getByRole("button", { name: /Start Case/ }).click();
  await page.getByRole("button", { name: /Continue to Imaging/ }).click();
  await page.getByRole("tab", { name: /2D Sialography/ }).click();
  await expect(page.getByText("Dedicated ductal mapping may be considered")).toBeVisible();
  await expect(page.locator(".phase-card")).toHaveCount(4);
  await expect(page.locator(".phase-card img")).toHaveCount(4);
  await expect(page.getByText(/Phase-specific interpretation · Five minutes/)).toBeVisible();
  await page.getByLabel("Upload Ductal filling").setInputFiles({ name: "synthetic-ductal", mimeType: "image/png", buffer: pixelPng });
  await expect(page.getByText(/4 of 4 phases available/)).toBeVisible();
  await expect(page.locator(".phase-card").filter({ hasText: "Ductal filling" }).getByRole("button", { name: "Restore built-in", exact: true })).toBeVisible();
});

test("case one built-in media, fusion, and image-bearing reports remain connected without uploads", async ({ page }) => {
  test.setTimeout(180_000);
  const writes: string[] = []; page.on("request", (request) => { if (["POST", "PUT", "PATCH"].includes(request.method())) writes.push(`${request.method()} ${request.url()}`); });
  await enterDemo(page);
  await page.locator(".case-card").first().getByRole("button", { name: /Start Case/ }).click();
  await page.getByRole("button", { name: /Continue to Imaging/ }).click();
  await expect(page.getByText(/Built-in Clinical Demo Media · Ultrasound ready · 4\/4 sialography phases ready/)).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Enter Clinical Demo/ }).click();
  await page.locator(".case-card").first().getByRole("button", { name: /Start Case/ }).click();
  await page.getByRole("button", { name: /Continue to Imaging/ }).click();
  await expect(page.getByText(/Built-in Clinical Demo Media · Ultrasound ready · 4\/4 sialography phases ready/)).toBeVisible();
  const video = page.locator("video");
  await expect(video).toHaveAttribute("src", /\/demo-cases\/case-01\/left-submandibular-ultrasound\.mp4$/);
  await page.getByRole("button", { name: "Play / Pause" }).click();
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Review educational reference findings" }).click();
  await page.getByRole("button", { name: "Confirm clinician review" }).click();
  await page.getByRole("tab", { name: /2D Sialography/ }).click();
  const phaseImages = page.locator(".phase-card img");
  await expect(phaseImages).toHaveCount(4);
  await expect.poll(() => phaseImages.evaluateAll((images: HTMLImageElement[]) => images.every((image) => image.src.includes("/demo-cases/case-01/") && image.naturalWidth > 1000 && image.naturalHeight > 700))).toBe(true);
  await expect(page.getByText(/Phase-specific interpretation · Five minutes/)).toBeVisible();
  await page.getByText(/Phase-specific interpretation · Five minutes/).click();
  await expect(page.getByText(/Incomplete contrast evacuation at five minutes, indicating delayed ductal clearance/)).toBeVisible();
  await page.getByRole("button", { name: "Review educational reference findings" }).click();
  await page.getByRole("button", { name: "Confirm clinician review" }).click();
  await page.getByRole("button", { name: /Continue to Modality Reports/ }).click();

  async function previewPdf(scope: import("@playwright/test").Locator, title: string) {
    await scope.getByRole("button", { name: "View PDF" }).click();
    const dialog = page.getByRole("dialog", { name: title });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Preview Ready")).toBeVisible();
    const pages = dialog.locator(".pdf-page-stack");
    await expect(pages.locator("canvas").first()).toBeVisible();
    const source = await pages.getAttribute("data-pdf-url");
    const result = await page.evaluate(async (url) => {
      const bytes = new Uint8Array(await (await fetch(url!)).arrayBuffer());
      return { size: bytes.length, signature: new TextDecoder("windows-1252").decode(bytes.slice(0, 8)) };
    }, source);
    expect(result.signature).toBe("%PDF-1.4");
    expect(result.size).toBeGreaterThan(1_000);
    await dialog.getByRole("button", { name: "Close PDF preview" }).click();
    await expect(dialog).toBeHidden();
  }

  async function downloadAndInspect(scope: import("@playwright/test").Locator, expectedImages: number, expectedText?: string, buttonName = "Download PDF") {
    const downloadPromise = page.waitForEvent("download");
    await scope.getByRole("button", { name: buttonName }).click();
    const download = await downloadPromise; const path = await download.path(); expect(path).toBeTruthy();
    const bytes = await readFile(path!); const source = bytes.toString("latin1");
    expect(source.startsWith("%PDF-1.4")).toBe(true);
    expect((source.match(/\/Subtype \/Image/g) ?? [])).toHaveLength(expectedImages);
    expect(source).toContain("/MediaBox [0 0 595.28 841.89]");
    expect(source).toContain("SaliFusion");
    expect(source).toContain("Educational Research Demonstration - Not Clinically Validated");
    expect(source).toContain("Page ");
    if (expectedText) expect(source).toContain(expectedText);
    if (process.env.PDF_QA_DIR) {
      await mkdir(process.env.PDF_QA_DIR, { recursive: true });
      await copyFile(path!, join(process.env.PDF_QA_DIR, download.suggestedFilename()));
    }
  }

  await expect(page.getByRole("heading", { name: "Modality Reports" })).toBeVisible();
  const ultrasoundReport = page.locator(".clinical-report-card").filter({ has: page.getByRole("heading", { name: "Ultrasound Report" }) });
  const sialographyReport = page.locator(".clinical-report-card").filter({ has: page.getByRole("heading", { name: "Four-Phase Sialography Report" }) });
  await expect(ultrasoundReport).toContainText("owner-authorized built-in ultrasound video");
  await expect(sialographyReport.locator(".phase-thumbnail-row img")).toHaveCount(4);
  await expect(page.getByText("No CBCT study provided")).toBeVisible();
  await previewPdf(ultrasoundReport, "Ultrasound Report");
  await downloadAndInspect(ultrasoundReport, 1);
  await previewPdf(sialographyReport, "Four-Phase Sialography Report");
  await downloadAndInspect(sialographyReport, 4);
  await page.getByRole("button", { name: /Continue to Fusion/ }).click();
  await page.getByRole("button", { name: "Generate Fusion Analysis" }).click();
  await expect(page.getByRole("heading", { name: "Integrated Multimodal Assessment" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Final Imaging Impression" })).toBeVisible();
  await page.getByRole("button", { name: "Modify Impression" }).click();
  const editedImpression = "Clinician-edited impression for verification.";
  await page.getByLabel("Final imaging impression").fill(editedImpression);
  await page.getByRole("button", { name: "Mark as Reviewed" }).click();
  await page.getByRole("button", { name: "View Fusion PDF" }).click();
  const fusionDialog = page.getByRole("dialog", { name: "Fusion Report" });
  await expect(fusionDialog).toBeVisible();
  await expect(fusionDialog.getByText("Preview Ready")).toBeVisible();
  await expect(fusionDialog.locator(".pdf-page-stack canvas").first()).toBeVisible();
  const fusionSource = await fusionDialog.locator(".pdf-page-stack").getAttribute("data-pdf-url");
  const fusionPdfText = await page.evaluate(async (url) => new TextDecoder("windows-1252").decode(await (await fetch(url!)).arrayBuffer()), fusionSource);
  expect(fusionPdfText).toContain(editedImpression);
  await fusionDialog.getByRole("button", { name: "Close PDF preview" }).click();
  const fusionActions = page.locator(".fusion-pdf-actions");
  await downloadAndInspect(fusionActions, 5, editedImpression, "Download Fusion PDF");
  await page.getByRole("button", { name: /Continue to Final Report/ }).click();
  await expect(page.getByRole("heading", { name: "SaliFusion Reports" })).toBeVisible();
  const completeReport = page.locator(".report-center-grid article").filter({ has: page.getByRole("heading", { name: "Complete Case Report" }) });
  await previewPdf(completeReport, "Complete Case Report");
  await downloadAndInspect(completeReport, 5, editedImpression);
  const completeInline = page.getByLabel("SaliFusion — Case 01 Complete Imaging Report inline PDF");
  await expect(completeInline.getByRole("button", { name: "View Complete PDF" })).toBeEnabled();
  await expect(completeInline.getByRole("button", { name: "Download Complete PDF" })).toBeEnabled();
  await expect(completeInline.getByRole("button", { name: "Print Complete Report" })).toBeEnabled();
  expect(writes).toEqual([]);
});

test("case one restores consented media and transfers a private bundle between isolated preview origins", async ({ page }) => {
  test.setTimeout(180_000);
  const writes: string[] = []; page.on("request", (request) => { if (["POST", "PUT", "PATCH"].includes(request.method())) writes.push(`${request.method()} ${request.url()}`); });
  await enterDemo(page);
  await page.locator(".case-card").first().getByRole("button", { name: /Start Case/ }).click();
  await page.getByRole("button", { name: /Continue to Imaging/ }).click();
  const videoBytes = await syntheticVideo(page);
  await page.getByLabel("Remember all Case 1 media on this device").check();
  await page.getByLabel("Load Case 1 ultrasound video").setInputFiles({ name: "persistent-ultrasound.webm", mimeType: "video/webm;codecs=vp8", buffer: videoBytes });
  await page.getByLabel("Load Case 1 Scout / precontrast").setInputFiles({ name: "persistent-scout.png", mimeType: "image/png", buffer: pixelPng });
  await page.getByLabel("Load Case 1 Ductal filling").setInputFiles({ name: "persistent-ductal.png", mimeType: "image/png", buffer: pixelPng });
  await page.getByLabel("Load Case 1 Acinar / parenchymal filling").setInputFiles({ name: "persistent-acinar.png", mimeType: "image/png", buffer: pixelPng });
  await page.getByLabel("Load Case 1 Evacuation").setInputFiles({ name: "persistent-evacuation.png", mimeType: "image/png", buffer: pixelPng });
  await expect(page.getByText(/Ultrasound ready · 4\/4 sialography phases ready/)).toBeVisible();
  await expect(page.getByText(/5\/5 replacement files stored only in this browser origin/)).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Private Case Media" }).click();
  const download = await downloadPromise;
  const bundlePath = await download.path();
  expect(bundlePath).toBeTruthy();
  const bundleBytes = await readFile(bundlePath!);
  expect(bundleBytes.length).toBeGreaterThan(videoBytes.length);

  await page.reload();
  await page.getByRole("button", { name: /Enter Clinical Demo/ }).click();
  await page.locator(".case-card").first().getByRole("button", { name: /Start Case/ }).click();
  await page.getByRole("button", { name: /Continue to Imaging/ }).click();
  await expect(page.getByText("persistent-ultrasound.webm")).toBeVisible();
  await expect(page.getByText(/Ultrasound ready · 4\/4 sialography phases ready/)).toBeVisible();
  await expect(page.getByText(/5\/5 replacement files stored only in this browser origin/)).toBeVisible();
  await expect(page.locator(".phase-card img")).toHaveCount(0);
  await page.getByRole("tab", { name: /2D Sialography/ }).click();
  await expect(page.locator(".phase-card img")).toHaveCount(4);

  await page.goto("http://127.0.0.1:4181/");
  await page.getByRole("button", { name: /Enter Clinical Demo/ }).click();
  await page.locator(".case-card").first().getByRole("button", { name: /Start Case/ }).click();
  await page.getByRole("button", { name: /Continue to Imaging/ }).click();
  await expect(page.getByText(/Built-in Clinical Demo Media · Ultrasound ready · 4\/4 sialography phases ready/)).toBeVisible();
  await page.getByLabel("Import Case 1 private media bundle").setInputFiles({ name: "case-01.salifusion-media", mimeType: "application/vnd.salifusion.private-media", buffer: bundleBytes });
  await expect(page.getByText(/Imported 5 Case 1 files locally/)).toBeVisible();
  await expect(page.getByText("persistent-ultrasound.webm")).toBeVisible();
  await page.getByRole("tab", { name: /2D Sialography/ }).click();
  await expect(page.locator(".phase-card img")).toHaveCount(4);
  expect(writes).toEqual([]);
});

test("case two uses one built-in composite video for four views, independent reports, and clinical-ultrasound PDFs", async ({ page }) => {
  test.setTimeout(180_000);
  const writes: string[] = []; page.on("request", (request) => { if (["POST", "PUT", "PATCH"].includes(request.method())) writes.push(`${request.method()} ${request.url()}`); });
  await enterDemo(page);
  await page.locator(".case-card").nth(1).getByRole("button", { name: /Start Case/ }).click();
  await expect(page.getByLabel("Patient age")).toHaveValue("26");
  await expect(page.getByLabel("Laterality")).toHaveValue("left");
  await page.getByRole("button", { name: /Continue to Imaging/ }).click();
  await expect(page.getByText("Case 2 — Bilateral Parotid Ultrasound Comparison")).toBeVisible();
  await expect(page.getByLabel("Load Case 2 Video")).toHaveCount(1);
  await expect(page.getByText("Built-in video ready", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Enter Clinical Demo/ }).click();
  await page.locator(".case-card").nth(1).getByRole("button", { name: /Start Case/ }).click();
  await page.getByRole("button", { name: /Continue to Imaging/ }).click();
  await expect(page.getByText("Built-in video ready", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Continue to Modality Reports/ }).click();
  await expect(page.getByRole("button", { name: "Review Findings to Finalize Report" })).toBeVisible();
  const draftInline = page.getByLabel("SaliFusion — Bilateral Parotid Ultrasound and Doppler Report inline PDF");
  await expect(draftInline).toBeVisible();
  await expect(page.getByText("Educational Draft PDF — Not Yet Clinician Reviewed", { exact: true }).last()).toBeVisible();
  await page.getByRole("button", { name: "Review Findings to Finalize Report" }).click();
  await page.getByLabel("Switch gland examination").selectOption({ index: 1 });
  const video = page.locator(".case-two-video-viewport video");
  await expect(video).toHaveAttribute("src", /\/demo-cases\/case-02\/bilateral-parotid-composite-ultrasound\.mp4$/);
  await expect(page.getByRole("tab", { name: /Full Comparison/ })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: /Left B-mode/ }).click();
  await expect(page.getByTestId("case-two-composite-stage")).toHaveClass(/region-lower-left/);
  await page.getByRole("tab", { name: /Right Doppler/ }).click();
  await expect(page.getByTestId("case-two-composite-stage")).toHaveClass(/region-upper-right/);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByLabel("Case 2 video timeline")).toBeEnabled();
  await page.getByRole("button", { name: "Review educational reference findings" }).click();
  await expect(page.getByRole("heading", { name: "Right Parotid — Reference Examination" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Left Parotid — Symptomatic Gland" })).toBeVisible();
  await expect(page.getByText(/Sjögren-related salivary gland changes/)).toBeVisible();
  await page.getByRole("button", { name: "Confirm clinician review" }).click();
  await page.getByRole("tab", { name: /2D Sialography/ }).click();
  await expect(page.getByText(/Defer During the Acute Inflammatory Episode/).first()).toBeVisible();
  await expect(page.getByText(/Previously acquired images may still be reviewed/)).toBeVisible();
  await page.getByRole("button", { name: /Continue to Modality Reports/ }).click();
  const report = page.locator(".case-two-ultrasound-report");
  await expect(report.getByRole("heading", { name: "Bilateral Parotid Ultrasound and Doppler Report" })).toBeVisible();
  const ultrasoundInline = page.getByLabel("SaliFusion — Bilateral Parotid Ultrasound and Doppler Report inline PDF");
  await expect(ultrasoundInline.getByRole("button", { name: "View Fullscreen" })).toBeEnabled();
  await expect(ultrasoundInline.getByRole("button", { name: "Download PDF" })).toBeEnabled();
  await expect(ultrasoundInline.getByRole("button", { name: "Print PDF" })).toBeEnabled();

  async function inspectInline(inline: ReturnType<typeof page.getByLabel>, expectedText?: string) {
    const pages = inline.locator(".pdf-page-stack canvas");
    await expect(pages.first()).toBeVisible();
    await expect.poll(() => pages.count()).toBeGreaterThanOrEqual(6);
    const source = await inline.locator(".pdf-page-stack").getAttribute("data-pdf-url");
    const pdf = await page.evaluate(async (url) => new TextDecoder("windows-1252").decode(await (await fetch(url!)).arrayBuffer()), source);
    expect(pdf).toContain("%PDF-1.4");
    expect((pdf.match(/\/Subtype \/Image/g) ?? [])).toHaveLength(5);
    expect(pdf).toContain("/MediaBox [0 0 595.28 841.89]");
    if (expectedText) expect(pdf).toContain(expectedText);
    const scroller = inline.locator(".pdf-preview-canvas.inline");
    await scroller.evaluate((node) => { node.scrollTop = node.scrollHeight; });
    await expect.poll(() => scroller.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
    return source;
  }
  async function inspectFullscreen(scope: ReturnType<typeof page.getByLabel>, buttonName: string, dialogName: string) {
    await scope.getByRole("button", { name: buttonName, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: dialogName });
    await expect(dialog.locator(".pdf-page-stack canvas").first()).toBeVisible();
    await dialog.getByRole("button", { name: "Close PDF preview" }).click();
  }
  async function archiveDownload(scope: ReturnType<typeof page.getByLabel>, buttonName: string) { if (!process.env.PDF_QA_DIR) return; const pending = page.waitForEvent("download"); await scope.getByRole("button", { name: buttonName, exact: true }).click(); const download = await pending; const path = await download.path(); expect(path).toBeTruthy(); await mkdir(process.env.PDF_QA_DIR, { recursive: true }); await copyFile(path!, join(process.env.PDF_QA_DIR, download.suggestedFilename())); }
  await inspectInline(ultrasoundInline);
  await inspectFullscreen(ultrasoundInline, "View Fullscreen", "Case 02 — Bilateral Parotid Ultrasound and Doppler Examination");
  await archiveDownload(ultrasoundInline, "Download PDF");
  await page.getByRole("button", { name: /Continue to Fusion/ }).click();
  await page.getByRole("button", { name: "Generate Integrated Assessment" }).click();
  await expect(page.locator("h1").filter({ hasText: "Integrated Clinical and Ultrasound Assessment" })).toBeVisible();
  const integratedInline = page.getByLabel("Integrated Clinical and Ultrasound Assessment inline PDF");
  const initialIntegratedUrl = await inspectInline(integratedInline);
  await page.getByRole("button", { name: "Modify Impression" }).click(); const edited = "Clinician-reviewed Case 2 impression retained in browser-generated reports."; await page.getByLabel("Final imaging impression").fill(edited);
  await page.getByRole("button", { name: "Mark Reviewed" }).click();
  await expect.poll(async () => { const updated = await integratedInline.locator(".pdf-page-stack").getAttribute("data-pdf-url"); return Boolean(updated && updated !== initialIntegratedUrl); }).toBe(true);
  await inspectInline(integratedInline, edited);
  await inspectFullscreen(integratedInline, "View Fullscreen", "Integrated Clinical and Ultrasound Assessment");
  await archiveDownload(integratedInline, "Download Integrated PDF");
  await page.getByRole("button", { name: /Continue to Final Report/ }).click();
  await expect(page.getByRole("heading", { name: "SaliFusion — Case 02 Complete Imaging Report" }).first()).toBeVisible();
  const completeInline = page.getByLabel("SaliFusion — Case 02 Complete Imaging Report inline PDF");
  await inspectInline(completeInline, edited);
  await inspectFullscreen(completeInline, "View Complete PDF", "Case 02 Complete Imaging Report");
  await archiveDownload(completeInline, "Download Complete PDF");
  await page.locator(".progress-nav button").filter({ hasText: "Imaging" }).click();
  await page.getByRole("tab", { name: /US Ultrasound/ }).click();
  const videoBytes = await syntheticVideo(page);
  await page.getByLabel("Load Case 2 Video").setInputFiles({ name: "replacement-four-panel.webm", mimeType: "video/webm;codecs=vp8", buffer: videoBytes });
  await page.locator(".progress-nav button").filter({ hasText: "Modality Reports" }).click();
  await expect(page.getByRole("button", { name: "Review Findings to Finalize Report" })).toBeVisible();
  await expect(page.getByLabel("SaliFusion — Bilateral Parotid Ultrasound and Doppler Report inline PDF")).toBeVisible();
  await expect(page.getByText("Educational Draft PDF — Not Yet Clinician Reviewed", { exact: true }).last()).toBeVisible();
  await page.locator(".progress-nav button").filter({ hasText: "Fusion" }).click();
  await expect(page.getByRole("button", { name: "Generate Integrated Assessment" })).toBeDisabled();
  expect(writes).toEqual([]);
});

test("case two restores an explicitly consented video from browser-local storage after refresh", async ({ page }) => {
  const writes: string[] = []; page.on("request", (request) => { if (["POST", "PUT", "PATCH"].includes(request.method())) writes.push(`${request.method()} ${request.url()}`); });
  await enterDemo(page);
  await page.locator(".case-card").nth(1).getByRole("button", { name: /Start Case/ }).click();
  await page.getByRole("button", { name: /Continue to Imaging/ }).click();
  const videoBytes = await syntheticVideo(page);
  await page.getByLabel("Load Case 2 Video").setInputFiles({ name: "persistent-synthetic-four-panel.webm", mimeType: "video/webm;codecs=vp8", buffer: videoBytes });
  await page.getByLabel("Remember this video on this device").check();
  await expect(page.getByText(/replacement is stored only in this authorized browser/i)).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Enter Clinical Demo/ }).click();
  await page.locator(".case-card").nth(1).getByRole("button", { name: /Start Case/ }).click();
  await page.getByRole("button", { name: /Continue to Imaging/ }).click();
  await expect(page.getByText("persistent-synthetic-four-panel.webm")).toBeVisible();
  await expect(page.getByText("Video loaded", { exact: true })).toBeVisible();
  await expect(page.locator(".case-two-video-viewport video")).toHaveAttribute("src", /^blob:/);
  expect(writes).toEqual([]);
});

test("case three preloads right-sided media and completes modality, fusion, and final PDFs", async ({ page }) => {
  test.setTimeout(180_000);
  const writes: string[] = []; page.on("request", (request) => { if (["POST", "PUT", "PATCH"].includes(request.method())) writes.push(`${request.method()} ${request.url()}`); });
  const downloadAndInspect = async (scope: import("@playwright/test").Locator, buttonName: string, expectedImages: number, archiveName: string) => {
    const downloadPromise = page.waitForEvent("download");
    await scope.getByRole("button", { name: buttonName, exact: true }).click();
    const download = await downloadPromise; const path = await download.path(); expect(path).toBeTruthy();
    const bytes = await readFile(path!); const source = bytes.toString("latin1");
    expect(source.startsWith("%PDF-1.4")).toBe(true);
    expect((source.match(/\/Subtype \/Image/g) ?? [])).toHaveLength(expectedImages);
    expect(source).toContain("right parotid");
    if (archiveName.includes("Ultrasound")) {
      expect(source).toContain("Representative Ultrasound Frame");
      expect(source).toContain("Subtle nonspecific right parotid parenchymal heterogeneity");
      expect(source).not.toContain("Four-Phase Sialography Image Review");
    }
    if (expectedImages > 1) expect(source).toContain("10 minutes");
    expect(source).not.toMatch(/Source Timing (?:Discrepancy|Limitation)|task brief|separate task brief|five-minute claim|corrected source media|timing confirmation|conflicting five-minute/i);
    if (process.env.PDF_QA_DIR) { await mkdir(process.env.PDF_QA_DIR, { recursive: true }); await copyFile(path!, join(process.env.PDF_QA_DIR, archiveName)); }
  };
  const previewPdf = async (scope: import("@playwright/test").Locator, buttonName: string, dialogName: string) => {
    await scope.getByRole("button", { name: buttonName, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: dialogName });
    await expect(dialog).toBeVisible(); await expect(dialog.getByText("Preview Ready")).toBeVisible(); await expect(dialog.locator("canvas").first()).toBeVisible();
    await dialog.getByRole("button", { name: "Close PDF preview" }).click();
  };

  await enterDemo(page);
  await page.locator(".case-card").nth(2).getByRole("button", { name: /Start Case/ }).click();
  await expect(page.getByLabel("Laterality")).toHaveValue("bilateral");
  await expect(page.getByRole("group", { name: "Xerostomia" }).getByRole("button", { name: "Yes", exact: true })).toHaveClass(/selected/);
  await expect(page.getByRole("group", { name: "Xerophthalmia" }).getByRole("button", { name: "Yes", exact: true })).toHaveClass(/selected/);
  await page.getByRole("button", { name: /Continue to Imaging/ }).click();
  const video = page.locator("video");
  await expect(video).toHaveAttribute("src", /\/demo-cases\/case-03\/right-parotid-ultrasound\.mp4$/);
  await expect(page.getByText(/Built-in Clinical Demo Media is served from this protected Preview/)).toBeVisible();
  await page.getByRole("button", { name: "Play / Pause" }).click();
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeGreaterThan(0);
  await page.reload(); await page.getByRole("button", { name: /Enter Clinical Demo/ }).click(); await page.locator(".case-card").nth(2).getByRole("button", { name: /Start Case/ }).click(); await page.getByRole("button", { name: /Continue to Imaging/ }).click();
  await expect(page.locator("video")).toHaveAttribute("src", /\/demo-cases\/case-03\/right-parotid-ultrasound\.mp4$/);
  await page.getByRole("button", { name: "Review educational reference findings" }).click(); await expect(page.getByText(/Subtle nonspecific right parotid parenchymal heterogeneity/).first()).toBeVisible(); await page.getByRole("button", { name: "Confirm clinician review" }).click();
  await page.getByRole("tab", { name: /2D Sialography/ }).click();
  await expect(page.getByText("Selective ductal assessment only")).toBeVisible();
  await expect(page.locator(".phase-card img")).toHaveCount(4);
  await expect.poll(() => page.locator(".phase-card img").evaluateAll((images: HTMLImageElement[]) => images.every((image) => image.src.includes("/demo-cases/case-03/") && image.naturalWidth > 800 && image.naturalHeight > 700))).toBe(true);
  await page.getByText(/Phase-specific interpretation · 10 minutes/).click();
  await expect(page.getByText(/Persistent intraglandular contrast retention and incomplete contrast evacuation are observed at 10 minutes/)).toBeVisible();
  await expect(page.getByText(/Source timing discrepancy|Source timing limitation|brief states five minutes|corrected source media/i)).toHaveCount(0);
  await page.getByRole("button", { name: "Review educational reference findings" }).click(); await page.getByRole("button", { name: "Confirm clinician review" }).click();
  await page.getByRole("button", { name: /Continue to Modality Reports/ }).click();
  const ultrasoundReport = page.locator(".clinical-report-card").filter({ has: page.getByRole("heading", { name: "Ultrasound Report" }) });
  const sialographyReport = page.locator(".clinical-report-card").filter({ has: page.getByRole("heading", { name: "Four-Phase Sialography Report" }) });
  await previewPdf(ultrasoundReport, "View PDF", "Ultrasound Report"); await downloadAndInspect(ultrasoundReport, "Download PDF", 1, "SaliFusion_Case03_Ultrasound_Report.pdf");
  await previewPdf(sialographyReport, "View PDF", "Four-Phase Sialography Report"); await downloadAndInspect(sialographyReport, "Download PDF", 4, "SaliFusion_Case03_Sialography_Report.pdf");
  await page.getByRole("button", { name: /Continue to Fusion/ }).click();
  await expect(page.getByRole("button", { name: "Generate Fusion Analysis" })).toBeEnabled(); await page.getByRole("button", { name: "Generate Fusion Analysis" }).click();
  await expect(page.getByText(/findings favor Sjögren syndrome as the leading diagnostic consideration/i)).toBeVisible();
  await expect(page.getByText(/Source timing discrepancy|Source timing limitation|five-minute statement/i)).toHaveCount(0);
  await previewPdf(page.locator(".fusion-pdf-actions"), "View Fusion PDF", "Fusion Report"); await downloadAndInspect(page.locator(".fusion-pdf-actions"), "Download Fusion PDF", 5, "SaliFusion_Case03_Fusion_Report.pdf");
  await page.getByRole("button", { name: "Mark Reviewed" }).click(); await page.getByRole("button", { name: /Continue to Final Report/ }).click();
  const completeCard = page.locator(".report-center-grid article").filter({ has: page.getByRole("heading", { name: "Complete Case Report" }) });
  await expect(completeCard).toContainText("Available"); await previewPdf(completeCard, "View PDF", "Complete Case Report"); await downloadAndInspect(completeCard, "Download PDF", 5, "SaliFusion_Case03_Complete_Case_Report.pdf");
  expect(writes).toEqual([]);
});

test("case four starts with an independent sialography pathway and reports five-minute delayed clearance", async ({ page }) => {
  await enterDemo(page);
  await page.locator(".case-card").nth(3).getByRole("button", { name: /Start Case/ }).click();
  await page.getByRole("button", { name: /Continue to Imaging/ }).click();
  await expect(page.getByRole("tab", { name: /2D Sialography/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".phase-card")).toHaveCount(4);
  await page.getByText(/Phase-specific interpretation · Five minutes/).click();
  await expect(page.getByText(/Incomplete contrast evacuation at five minutes/)).toBeVisible();
  await page.getByRole("button", { name: "Review educational reference findings" }).click();
  await page.getByRole("button", { name: /Continue to Modality Reports/ }).click();
  await expect(page.getByText("Educational reference reviewed").first()).toBeVisible();
});

test("case five preserves right submandibular identity, not-provided scout, and ultrasound/MRI recommendations", async ({ page }) => {
  await enterDemo(page);
  await page.locator(".case-card").nth(4).getByRole("button", { name: /Start Case/ }).click();
  await expect(page.getByLabel("Patient age")).toHaveValue("42");
  await expect(page.getByLabel("Affected gland")).toHaveValue("submandibular");
  await expect(page.getByLabel("Laterality")).toHaveValue("right");
  await page.getByRole("button", { name: /Continue to Imaging/ }).click();
  await page.getByRole("tab", { name: /2D Sialography/ }).click();
  await expect(page.locator(".phase-card").first().getByText("Not Provided").first()).toBeVisible();
  await page.getByRole("button", { name: "Review educational reference findings" }).click();
  await expect(page.getByText(/Targeted Ultrasound of the Right Submandibular Gland with Color\/Power Doppler/)).toBeVisible();
  await expect(page.getByText(/MRI of the Neck and Right Submandibular Region/)).toBeVisible();
});
