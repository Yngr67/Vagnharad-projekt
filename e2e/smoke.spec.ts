import { test, expect } from "@playwright/test";
import { login, syncNow } from "./helpers";

test("login → sync → overview shows milestone and data date → search", async ({ page }) => {
  await login(page);
  await syncNow(page);
  await page.reload();
  await expect(page.getByText("tidplan per 2026-10-15")).toBeVisible();
  const upcoming = page.getByTestId("upcoming-milestones");
  await expect(upcoming.getByText("Anbudsdag testbro")).toBeVisible();

  await page.getByRole("link", { name: "Dokument" }).click();
  await expect(page.getByRole("cell", { name: "XX99 Testtidplan okt.pdf" })).toBeVisible();

  await page.getByRole("link", { name: "Sök" }).click();
  await page.getByRole("searchbox").fill("Provmilstolpe");
  await page.getByRole("button", { name: "Sök" }).click();
  await expect(page.getByTestId("search-hit").first()).toContainText("XX99 Testtidplan");
});
