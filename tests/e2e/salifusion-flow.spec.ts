import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

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

  async function downloadAndCountImages(buttonName: string | RegExp, expected: number) {
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: buttonName }).click();
    const download = await downloadPromise; const path = await download.path(); expect(path).toBeTruthy();
    const bytes = await readFile(path!); const source = bytes.toString("latin1");
    expect(source.startsWith("%PDF-1.4")).toBe(true);
    expect((source.match(/\/Subtype \/Image/g) ?? [])).toHaveLength(expected);
  }

  await downloadAndCountImages("Download Ultrasound PDF", 1);
  await downloadAndCountImages("Download 2D Sialography PDF", 4);
  await page.getByRole("button", { name: /Continue to Fusion/ }).click();
  await page.getByRole("button", { name: "Generate Fusion Analysis" }).click();
  await downloadAndCountImages("Download Fusion PDF", 5);
  await page.getByRole("button", { name: /Continue to Final Report/ }).click();
  await downloadAndCountImages("Download Complete Case Report", 5);
  expect(writes).toEqual([]);
});

test("acute case offers four comparison clips and a restrained safety stop", async ({ page }) => {
  await enterDemo(page);
  await page.locator(".case-card").nth(1).getByRole("button", { name: /Start Case/ }).click();
  await page.getByRole("button", { name: /Continue to Imaging/ }).click();
  await expect(page.getByLabel("Select demo clip").locator("option")).toHaveCount(4);
  await page.getByRole("button", { name: "Side-by-side comparison" }).click();
  await expect(page.locator(".ultrasound-stage.compare")).toBeVisible();
  await page.getByRole("tab", { name: /2D Sialography/ }).click();
  await expect(page.getByText(/Not Appropriate at This Stage/).first()).toBeVisible();
  await expect(page.getByText(/Previously acquired images may still be reviewed/)).toBeVisible();
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
  await expect(page.getByText(/Educational reference reviewed · images pending/)).toBeVisible();
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
