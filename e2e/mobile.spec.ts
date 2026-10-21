import { expect, test } from "@playwright/test";

test("mobile: menu, sticky add-to-cart and no horizontal scroll", async ({ page }) => {
  await page.goto("/products/portable-pet-water-bottle");
  await page.getByRole("button", { name: "Reject non-essential" }).click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("dialog", { name: "Menu" }).getByRole("link", { name: "Shop" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.evaluate(() => window.scrollTo(0, 2500));
  const sticky = page.locator("div.fixed.inset-x-0.bottom-0");
  await expect(sticky.getByRole("button", { name: "Add to Cart" })).toBeVisible();
  await sticky.getByRole("button", { name: "Add to Cart" }).click();
  await expect(page.getByRole("link", { name: /Shopping cart, 1 item/ })).toBeVisible();
});
