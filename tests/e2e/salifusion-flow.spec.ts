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
  await expect(page.getByText("Ultrasound pending")).toBeVisible();
  await expect(page.getByText("0/4 sialography phases ready")).toBeVisible();
  await page.getByRole("button", { name: "All cases" }).click();
  await page.locator(".case-card").first().getByRole("button", { name: /Continue at Imaging/ }).click();
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.getByLabel("Patient age")).toHaveValue("43");
});

test("case one supports independent findings and partial four-phase sialography", async ({ page }) => {
  await enterDemo(page);
  await page.locator(".case-card").first().getByRole("button", { name: /Start Case/ }).click();
  await page.getByRole("button", { name: /Continue to Imaging/ }).click();
  await page.getByRole("tab", { name: /2D Sialography/ }).click();
  await expect(page.getByText("Dedicated ductal mapping may be considered")).toBeVisible();
  await expect(page.locator(".phase-card")).toHaveCount(4);
  await expect(page.getByText(/Not Documented/)).toBeVisible();
  await page.getByLabel("Upload Ductal filling").setInputFiles({ name: "synthetic-ductal", mimeType: "image/png", buffer: pixelPng });
  await expect(page.getByText(/1 of 4 phases available/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove", exact: true })).toBeVisible();
});

test("case one browser-local media and image-bearing reports remain connected without upload requests", async ({ page }) => {
  test.setTimeout(120_000);
  const writes: string[] = []; page.on("request", (request) => { if (["POST", "PUT", "PATCH"].includes(request.method())) writes.push(`${request.method()} ${request.url()}`); });
  await enterDemo(page);
  await page.locator(".case-card").first().getByRole("button", { name: /Start Case/ }).click();
  await page.getByRole("button", { name: /Continue to Imaging/ }).click();
  const videoBytes = await syntheticVideo(page);
  await page.getByLabel("Load Case 1 ultrasound video").setInputFiles({ name: "synthetic-review.webm", mimeType: "video/webm;codecs=vp8", buffer: videoBytes });
  await page.getByLabel("Load Case 1 Scout / precontrast").setInputFiles({ name: "synthetic-scout", mimeType: "image/png", buffer: pixelPng });
  await page.getByLabel("Load Case 1 Ductal filling").setInputFiles({ name: "synthetic-ductal", mimeType: "image/png", buffer: pixelPng });
  await page.getByLabel("Load Case 1 Acinar / parenchymal filling").setInputFiles({ name: "synthetic-acinar", mimeType: "image/png", buffer: pixelPng });
  await page.getByLabel("Load Case 1 Evacuation").setInputFiles({ name: "synthetic-evacuation", mimeType: "image/png", buffer: pixelPng });
  await expect(page.getByText("Ultrasound ready")).toBeVisible(); await expect(page.getByText("4/4 sialography phases ready")).toBeVisible();
  const video = page.locator("video");
  await expect(video).toHaveAttribute("src", /^blob:/);
  await page.getByRole("button", { name: "Play / Pause" }).click();
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Review educational reference findings" }).click();
  await page.getByRole("tab", { name: /2D Sialography/ }).click();
  const phaseImages = page.locator(".phase-card img");
  await expect(phaseImages).toHaveCount(4);
  await expect.poll(() => phaseImages.evaluateAll((images: HTMLImageElement[]) => images.every((image) => image.src.startsWith("blob:") && image.naturalWidth === 1 && image.naturalHeight === 1))).toBe(true);
  await expect(page.getByText(/Phase-specific interpretation · Not Documented/)).toBeVisible();
  await page.getByRole("button", { name: "Review educational reference findings" }).click();
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
  await expect(ultrasoundReport).toContainText("Browser-local ultrasound media are available");
  await expect(ultrasoundReport).not.toContainText("awaiting user-supplied media");
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
  expect(writes).toEqual([]);
});

test("case two uses one local composite video for four views, independent reports, and clinical-ultrasound PDFs", async ({ page }) => {
  test.setTimeout(120_000);
  const writes: string[] = []; page.on("request", (request) => { if (["POST", "PUT", "PATCH"].includes(request.method())) writes.push(`${request.method()} ${request.url()}`); });
  await enterDemo(page);
  await page.locator(".case-card").nth(1).getByRole("button", { name: /Start Case/ }).click();
  await expect(page.getByLabel("Patient age")).toHaveValue("26");
  await expect(page.getByLabel("Laterality")).toHaveValue("left");
  await page.getByRole("button", { name: /Continue to Imaging/ }).click();
  await expect(page.getByText("Case 2 — Bilateral Parotid Ultrasound Comparison")).toBeVisible();
  await expect(page.getByLabel("Load Case 2 Video")).toHaveCount(1);
  const videoBytes = await syntheticVideo(page);
  await page.getByLabel("Remember this video on this device").check();
  await page.getByLabel("Load Case 2 Video").setInputFiles({ name: "synthetic-four-panel.webm", mimeType: "video/webm;codecs=vp8", buffer: videoBytes });
  await expect(page.getByText("Video loaded", { exact: true })).toBeVisible();
  await expect(page.getByText(/Stored only in this authorized browser/)).toBeVisible();
  await page.getByLabel("Switch gland examination").selectOption({ index: 1 });
  const video = page.locator(".case-two-video-viewport video");
  await expect(video).toHaveAttribute("src", /^blob:/);
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
  await expect(report.getByRole("button", { name: "View Report", exact: true })).toBeVisible();
  await expect(report.getByRole("button", { name: "View PDF", exact: true })).toBeEnabled();
  await expect(report.getByRole("button", { name: "Download PDF", exact: true })).toBeEnabled();
  await expect(report.getByText("Patient History Summary")).toBeVisible();
  await expect(report.getByText("Right Parotid B-mode Findings")).toBeVisible();
  await expect(report.getByText("Left Doppler Findings")).toBeVisible();

  async function inspectPdf(buttonName: string, dialogName: string, expectedText?: string) {
    await page.getByRole("button", { name: buttonName, exact: true }).click(); const dialog = page.getByRole("dialog", { name: dialogName }); await expect(dialog).toBeVisible(); await expect(dialog.locator(".pdf-page-stack canvas").first()).toBeVisible(); const source = await dialog.locator(".pdf-page-stack").getAttribute("data-pdf-url"); const pdf = await page.evaluate(async (url) => new TextDecoder("windows-1252").decode(await (await fetch(url!)).arrayBuffer()), source); expect(pdf).toContain("%PDF-1.4"); expect((pdf.match(/\/Subtype \/Image/g) ?? [])).toHaveLength(5); expect(pdf).toContain("/MediaBox [0 0 595.28 841.89]"); if (expectedText) expect(pdf).toContain(expectedText); await dialog.getByRole("button", { name: "Close PDF preview" }).click();
  }
  async function archiveDownload(buttonName: string) { if (!process.env.PDF_QA_DIR) return; const pending = page.waitForEvent("download"); await page.getByRole("button", { name: buttonName, exact: true }).click(); const download = await pending; const path = await download.path(); expect(path).toBeTruthy(); await mkdir(process.env.PDF_QA_DIR, { recursive: true }); await copyFile(path!, join(process.env.PDF_QA_DIR, download.suggestedFilename())); }
  await inspectPdf("View PDF", "Case 02 — Bilateral Parotid Ultrasound and Doppler Examination");
  await archiveDownload("Download PDF");
  await page.getByRole("button", { name: /Continue to Fusion/ }).click();
  await page.getByRole("button", { name: "Generate Integrated Assessment" }).click();
  await expect(page.getByRole("heading", { name: "Integrated Clinical and Ultrasound Assessment" })).toBeVisible();
  await page.getByRole("button", { name: "Modify Impression" }).click(); const edited = "Clinician-reviewed Case 2 impression retained in browser-generated reports."; await page.getByLabel("Final imaging impression").fill(edited); await page.getByRole("button", { name: "Mark Reviewed" }).click();
  await inspectPdf("View Integrated PDF", "Integrated Clinical and Ultrasound Assessment", edited);
  await archiveDownload("Download Integrated PDF");
  await page.getByRole("button", { name: /Continue to Final Report/ }).click();
  await expect(page.getByRole("heading", { name: "Case 02 Complete Imaging Report" }).first()).toBeVisible();
  await inspectPdf("View Complete Case PDF", "Case 02 Complete Imaging Report", edited);
  await archiveDownload("Download Complete Case PDF");
  expect(writes).toEqual([]);
});

test("case two restores an explicitly consented video from browser-local storage after refresh", async ({ page }) => {
  const writes: string[] = []; page.on("request", (request) => { if (["POST", "PUT", "PATCH"].includes(request.method())) writes.push(`${request.method()} ${request.url()}`); });
  await enterDemo(page);
  await page.locator(".case-card").nth(1).getByRole("button", { name: /Start Case/ }).click();
  await page.getByRole("button", { name: /Continue to Imaging/ }).click();
  const videoBytes = await syntheticVideo(page);
  await page.getByLabel("Remember this video on this device").check();
  await page.getByLabel("Load Case 2 Video").setInputFiles({ name: "persistent-synthetic-four-panel.webm", mimeType: "video/webm;codecs=vp8", buffer: videoBytes });
  await expect(page.getByText(/Stored only in this authorized browser/)).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Enter Clinical Demo/ }).click();
  await page.locator(".case-card").nth(1).getByRole("button", { name: /Start Case/ }).click();
  await page.getByRole("button", { name: /Continue to Imaging/ }).click();
  await expect(page.getByText("persistent-synthetic-four-panel.webm")).toBeVisible();
  await expect(page.getByText("Video loaded", { exact: true })).toBeVisible();
  await expect(page.locator(".case-two-video-viewport video")).toHaveAttribute("src", /^blob:/);
  expect(writes).toEqual([]);
});

test("case three presents selective ductal reasoning and score disclaimer", async ({ page }) => {
  await enterDemo(page);
  await page.locator(".case-card").nth(2).getByRole("button", { name: /Start Case/ }).click();
  await page.getByRole("button", { name: /Continue to Imaging/ }).click();
  await page.getByRole("button", { name: "Review educational reference findings" }).click();
  await expect(page.getByText(/No definite sonographic parenchymal abnormality/).first()).toBeVisible();
  await page.getByRole("tab", { name: /2D Sialography/ }).click();
  await expect(page.getByText("Selective ductal assessment only")).toBeVisible();
  await expect(page.getByText("Educational Scenario Findings — Awaiting Image Verification").first()).toBeVisible();
  await expect(page.getByText(/Phase-specific interpretation/).first()).toBeVisible();
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
