import { test, expect } from "@playwright/test";
import { login, syncViaApi } from "./helpers";

test.beforeAll(async ({ request }) => {
  await syncViaApi(request);
});

test("version selector shows both synthetic versions", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Tidplan", exact: true }).click();
  const options = page.getByLabel("Tidplanversion").locator("option");
  await expect(options).toHaveCount(2);
  await expect(options.first()).toContainText("2026-10-15");
  await expect(page.getByText("Avstämningsdatum 2026-10-15")).toBeVisible();
});

test("create action from milestone then it appears in Actions and in overview counts", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Tidplan", exact: true }).click();
  await page.getByLabel("Bara milstolpar").check();
  await page.getByRole("button", { name: "Visa" }).click();
  const row = page.getByRole("row").filter({ hasText: "Anbudsdag testbro" });
  await row.getByRole("button", { name: "Skapa action" }).click();
  await expect(row.getByText("Action finns")).toBeVisible();

  await page.getByRole("link", { name: "Actions", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: "Anbudsdag testbro" })).toContainText("2026-11-20");

  await page.getByRole("link", { name: "Översikt", exact: true }).click();
  await expect(page.getByText("Öppna actions").locator("..")).toContainText("1");
});

test("manual action create and close", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Actions", exact: true }).click();
  const form = page.getByRole("form", { name: "Ny action" });
  await form.getByLabel("Titel").fill("Ring beställaren om PQ");
  await form.getByLabel("Ansvarig").fill("Peter");
  await form.getByLabel("Deadline").fill("2026-11-05");
  await form.getByRole("button", { name: "Lägg till" }).click();
  const row = page.getByRole("row").filter({ hasText: "Ring beställaren om PQ" });
  await expect(row).toContainText("Försenad");
  await row.getByRole("button", { name: "Markera klar" }).click();
  await expect(page.getByRole("row").filter({ hasText: "Ring beställaren om PQ" })).toContainText("Klar");
});
