import { expect, test } from "@playwright/test";

async function enterDemo(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Intelligent Salivary/ })).toBeVisible();
  await page.getByRole("button", { name: /Enter Clinical Demo/ }).click();
  await expect(page.getByRole("heading", { name: "Choose a clinical journey" })).toBeVisible();
}

test("landing entry exposes exactly three focused cases and editable history", async ({ page }) => {
  await enterDemo(page);
  await expect(page.locator(".case-card")).toHaveCount(3);
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
  await expect(page.getByText(/left submandibular ductal sialolithiasis/i)).toBeVisible();
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
  await page.getByRole("tab", { name: /2D Sialography/ }).click();
  await expect(page.getByText("Selective ductal assessment only")).toBeVisible();
  await expect(page.getByText("Key educational phase awaiting upload")).toBeVisible();
});
