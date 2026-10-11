import { expect, test } from "@playwright/test";

test("guided competition path resolves an ultrasound-negative obstruction", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Run competition demo/ }).click();
  await expect(page.getByText("Competition Demo", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.getByRole("heading", { name: "Ultrasound" })).toBeVisible();
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.getByText("Inconclusive ultrasound in a clinically obstructive presentation").first()).toBeVisible();
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.getByRole("heading", { name: "2D Sialography" })).toBeVisible();
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.getByText("Proximal Stensen duct stenosis", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.getByText("Automatic fusion active")).toBeVisible();
  await expect(page.getByText(/stenosis occult on ultrasound/i)).toBeVisible();
});

test("acute infection case prevents an unsafe sialography recommendation", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open safety-stop case" }).click();
  await expect(page.getByText(/Routine retrograde contrast sialography is inappropriate/i).first()).toBeVisible();
  await expect(page.getByText("Currently inappropriate").first()).toBeVisible();
});

test("standalone 2D sialography exposes missing phase states", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open workstation" }).click();
  await page.getByLabel("Educational case").selectOption("distal-wharton-calculus");
  await page.getByRole("button", { name: /2D Sialography/ }).first().click();
  await expect(page.getByText("Partial studies are supported")).toBeVisible();
  await expect(page.getByRole("button", { name: /Evacuation Not supplied/ })).toBeDisabled();
});
