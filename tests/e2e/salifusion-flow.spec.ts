import { expect, test } from "@playwright/test";

test("judge can complete a curated case and generate a report", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open Demo Case" }).click();
  await page.getByRole("button", { name: /Space-Occupying Lesion/ }).click();
  await expect(page.getByText("Curated reference image").first()).toBeVisible();
  await page.getByRole("button", { name: "Run AI Analysis" }).click();
  await expect(page.getByText("Simulated AI output — proof-of-concept demonstration.")).toBeVisible();
  await expect(page.locator(".result-summary").getByText("High Concordance")).toBeVisible();
  await page.getByRole("button", { name: "Generate Integrated Report" }).click();
  await expect(page.getByText("Integrated imaging report · proof of concept")).toBeVisible();
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page.getByText("Accepted", { exact: true })).toBeVisible();
});

test("arbitrary fallback image can be viewed but cannot be diagnosed", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start New Analysis" }).click();
  await page.getByLabel("Patient ID").fill("LOCAL-001");
  await page.getByLabel("Age").fill("42");
  await page.getByLabel("Sex").selectOption("Female");
  await page.getByLabel("Gland").selectOption("Parotid");
  await page.getByLabel("Side").selectOption("Left");
  await page.getByRole("button", { name: "Continue to modality" }).click();
  await page.getByRole("button", { name: /^01 Ultrasound/ }).click();
  await page.getByRole("button", { name: "Continue to image import" }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "local.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") });
  await expect(page.getByText("Image loaded successfully.")).toBeVisible();
  await expect(page.getByText("AI inference is currently available only for curated demonstration cases.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Run AI Analysis" })).toBeDisabled();
});
