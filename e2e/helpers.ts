import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { E2E_PASSWORD } from "../playwright.config";

export async function login(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Lösenord").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Logga in" }).click();
  await expect(page).toHaveURL(/\/$/);
}

export async function syncNow(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Synka nu" }).click();
  await expect(page.getByTestId("sync-report")).toBeVisible({ timeout: 30_000 });
}

/** Synkar fejk-Drive via API:t (idempotent), så att testerna inte beror på varandras ordning. */
export async function syncViaApi(request: APIRequestContext): Promise<void> {
  const res = await request.post("/api/sync", { headers: { authorization: "Bearer e2e-sync-token-0001" } });
  expect(res.ok()).toBe(true);
}
