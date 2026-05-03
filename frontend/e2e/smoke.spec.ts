import { expect, test } from "@playwright/test";

test.describe("SPA smoke", () => {
  test("главная: шапка, приветствие и навигация", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/Library Nexus/i);
    await expect(page.getByText("Library Nexus").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Главная" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Начать работу" })).toBeVisible();

    await page.getByRole("link", { name: "Вход" }).click();
    await expect(page).toHaveURL(/\/auth/);
    await expect(page.getByRole("heading", { name: "Авторизация" })).toBeVisible();
  });
});
