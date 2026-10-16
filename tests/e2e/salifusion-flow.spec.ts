import { expect, test } from "@playwright/test";

async function enterDemo(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Intelligent Salivary/ })).toBeVisible();
  await page.getByRole("button", { name: /Enter Clinical Demo/ }).click();
  await expect(page.getByRole("heading", { name: "Choose a clinical journey" })).toBeVisible();
}

test("approved landing entry exposes exactly five focused cases and editable history", async ({ page }) => {
  await enterDemo(page);
  await expect(page.locator(".case-card")).toHaveCount(5);
  await page.locator(".case-card").first().getByRole("button", { name: /Start Case/ }).click();
  await expect(page.getByRole("heading", { name: "Patient history" })).toBeVisible();
  await page.getByLabel("Patient age").fill("43");
  await page.getByRole("button", { name: /Continue to Imaging/ }).click();
  await expect(page.getByRole("heading", { name: "Imaging workspace" })).toBeVisible();
  await expect(page.getByText("Educational clip awaiting upload")).toBeVisible();
  await page.getByRole("button", { name: "All cases" }).click();
  await page.locator(".case-card").first().getByRole("button", { name: /Continue at Imaging/ }).click();
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.getByLabel("Patient age")).toHaveValue("43");
});

test("case one supports independent findings and partial four-phase sialography", async ({ page }) => {
  await enterDemo(page);
  await page.locator(".case-card").first().getByRole("button", { name: /Start Case/ }).click();
  await page.getByRole("button", { name: /Continue to Imaging/ }).click();
  await page.getByRole("button", { name: "Review educational reference findings" }).click();
  await expect(page.getByText(/left submandibular obstructive sialolithiasis/i)).toBeVisible();
  await page.getByRole("tab", { name: /2D Sialography/ }).click();
  await expect(page.getByText("Dedicated ductal mapping may be considered")).toBeVisible();
  await expect(page.locator(".phase-card")).toHaveCount(4);
  await page.getByLabel("Upload Ductal filling").setInputFiles({ name: "ductal.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") });
  await expect(page.getByText(/1 of 4 phases supplied/)).toBeVisible();
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
