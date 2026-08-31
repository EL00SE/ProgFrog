import { expect, test } from "@playwright/test";

test("home page renders the hero", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /watch every lift go up/i }),
  ).toBeVisible();
});

test("visiting a protected route redirects to sign-in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByText(/sign in to progfrog/i)).toBeVisible();
});
