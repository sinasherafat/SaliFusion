import { expect, test } from "@playwright/test";

async function enterPatient(page: import("@playwright/test").Page) {
  await page.getByLabel("Patient Name").fill("Demo Patient");
  await page.getByLabel("Patient ID").fill("LOCAL-001");
  await page.getByLabel("Age").fill("42");
  await page.getByLabel("Sex").selectOption("Female");
  await page.getByLabel("Gland").selectOption("Parotid");
  await page.getByLabel("Side").selectOption("Left");
  await page.getByText("Meal-related symptoms", { exact: true }).click();
  await page.getByLabel("Clinical History / Notes").fill("Recurrent meal-related swelling for six months.");
  await page.getByRole("button", { name: "Continue to modality" }).click();
}

test("manual single-modality workflow carries patient data and recommendation into the report", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start New Analysis" }).click();
  await enterPatient(page);

  const cards = page.locator(".modality-card");
  await expect(cards).toHaveCount(4);
  await expect(cards.nth(0)).toContainText("Ultrasound");
  await expect(cards.nth(1)).toContainText("2D Sialography");
  await expect(cards.nth(2)).toContainText("3D / CBCT Sialography");
  await expect(cards.nth(3)).toContainText("MR Sialography");
  await expect(page.getByRole("button", { name: /Multimodal Analysis/ })).toHaveCount(0);

  await cards.nth(0).click();
  await page.getByRole("button", { name: "Continue to image import" }).click();
  await page.getByRole("button", { name: /Ultrasound-Sufficient Stone/ }).click();
  await expect(page.getByText("Curated image recognized")).toBeVisible();
  await page.getByRole("button", { name: "Run AI Analysis" }).click();
  await expect(page.getByText("Additional Imaging Recommendation")).toBeVisible();
  await expect(page.getByText(/No additional imaging is required/)).toBeVisible();
  await page.getByRole("button", { name: "Generate Report" }).click();
  await expect(page.getByText("Single-modality imaging report · proof of concept")).toBeVisible();
  await expect(page.getByText("Demo Patient", { exact: true })).toBeVisible();
  await expect(page.getByText("Recurrent meal-related swelling for six months.")).toBeVisible();
});

test("adding a second modality automatically starts fusion and creates an integrated report", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open Demo Case" }).click();
  await page.getByRole("button", { name: /Ball-in-hand lesion/ }).click();
  await expect(page.getByText("Curated reference image")).toBeVisible();
  await page.getByRole("button", { name: "Run AI Analysis" }).click();
  await expect(page.getByText(/Ultrasound is recommended for lesion characterization/)).toBeVisible();
  await page.getByRole("button", { name: "Add Another Modality" }).click();
  await page.locator(".modality-card").filter({ hasText: "Ultrasound" }).click();
  await page.getByRole("button", { name: "Continue to image import" }).click();
  await page.getByRole("button", { name: /Ball-in-hand lesion/ }).click();
  await page.getByRole("button", { name: "Run AI Analysis" }).click();
  await expect(page.getByText("Automatic fusion active")).toBeVisible();
  await expect(page.locator(".result-summary").getByText("High Concordance", { exact: true })).toBeVisible();
  await expect(page.getByText("Integrated assessment")).toBeVisible();
  await page.getByRole("button", { name: "Generate Integrated Report" }).click();
  await expect(page.getByText("Integrated imaging report · proof of concept")).toBeVisible();
  await expect(page.getByText("Cross-modal concordance / discordance")).toBeVisible();
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page.getByText("Accepted", { exact: true })).toBeVisible();
});

test("MR pathway exists without a fabricated curated result", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start New Analysis" }).click();
  await enterPatient(page);
  await page.locator(".modality-card").filter({ hasText: "MR Sialography" }).click();
  await page.getByRole("button", { name: "Continue to image import" }).click();
  await expect(page.getByText("No predefined demo case is currently packaged for MR Sialography.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Run AI Analysis" })).toBeDisabled();
});

test("arbitrary fallback image can be viewed but cannot be diagnosed", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start New Analysis" }).click();
  await enterPatient(page);
  await page.locator(".modality-card").filter({ hasText: "Ultrasound" }).click();
  await page.getByRole("button", { name: "Continue to image import" }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "local.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") });
  await expect(page.getByText("Image loaded successfully.")).toBeVisible();
  await expect(page.getByText("AI inference is currently available only for curated demonstration cases.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Run AI Analysis" })).toBeDisabled();
});
