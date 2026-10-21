import { expect, test, type Page } from "@playwright/test";
import { totp } from "./totp";

test.describe.configure({ mode: "serial" });

let orderNumber = "";
let guestOrderUrl = "";

async function rejectCookies(page: Page) {
  const banner = page.getByRole("dialog", { name: "Your privacy choices" });
  if (await banner.isVisible()) await banner.getByRole("button", { name: "Reject non-essential" }).click();
  await expect(banner).toBeHidden();
}

test("homepage shows truthful content and no fake reviews", async ({ page }) => {
  await page.goto("/");
  await rejectCookies(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Every Adventure Deserves a Happy, Hydrated Pet.");
  await expect(page.getByText("No reviews yet")).toBeVisible();
  // Unverified supplier claims must not be shown.
  await expect(page.getByText("Designed to help prevent leaks")).toHaveCount(0);
});

test("guest can buy the product end-to-end (simulated payment)", async ({ page }) => {
  await page.goto("/products/portable-pet-water-bottle");
  await rejectCookies(page);
  await expect(page.getByRole("heading", { name: "Portable Pet Water Bottle" })).toBeVisible();
  await expect(page.getByText("€24.90").first()).toBeVisible();

  await page.getByText("Sky Blue (", { exact: false }).or(page.locator("label[title='Sky Blue']")).first().click();
  await page.getByRole("button", { name: "Increase quantity" }).click();
  await page.getByRole("button", { name: "Add to Cart" }).first().click();
  await expect(page.getByText("Added to your cart.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Shopping cart, 2 items/ })).toBeVisible();

  await page.goto("/cart");
  await expect(page.getByText("Sky Blue")).toBeVisible();
  await expect(page.getByText("€49.80").first()).toBeVisible();
  await page.getByRole("link", { name: "Checkout", exact: true }).click();

  await expect(page).toHaveURL(/\/checkout/, { timeout: 30_000 });
  await page.locator("main").getByLabel("Email address").fill("guest.buyer@example.com");
  // Seller identification and withdrawal info are disclosed before payment.
  await expect(page.getByText("Seller:")).toBeVisible();
  await page.getByRole("button", { name: /Order with obligation to pay/ }).click();
  await expect(page.getByText("Please accept the Terms and Conditions")).toBeVisible();
  await page.getByLabel(/I have read and accept the Terms/).check();
  await page.getByRole("button", { name: /Order with obligation to pay/ }).click();

  await expect(page).toHaveURL(/\/checkout\/simulate/);
  await page.getByRole("button", { name: "Simulate successful payment" }).click();
  await expect(page.getByRole("heading", { name: "Thank you for your order!" })).toBeVisible();
  const text = await page.getByText(/Order WP-[A-Z0-9]+ is confirmed/).textContent();
  orderNumber = /WP-[A-Z0-9]+/.exec(text ?? "")![0];
  guestOrderUrl = (await page.getByRole("link", { name: "View order status" }).getAttribute("href"))!;

  await page.goto("/cart");
  await expect(page.getByText("Your cart is empty")).toBeVisible();
});

test("guest order lookup requires the matching email", async ({ page }) => {
  await page.goto("/track");
  await rejectCookies(page);
  await page.getByLabel("Order number").fill(orderNumber);
  await page.locator("main").getByLabel("Email", { exact: true }).fill("wrong@example.com");
  await page.getByRole("button", { name: "Find order" }).click();
  await expect(page.getByText("We couldn't find an order")).toBeVisible();
  await page.locator("main").getByLabel("Email", { exact: true }).fill("guest.buyer@example.com");
  await page.getByRole("button", { name: "Find order" }).click();
  await expect(page.getByText(`Order ${orderNumber}`)).toBeVisible();
});

test("admin signs in with 2FA, fulfils via CJ (mock) and the customer sees tracking", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/account\/login/);
  await rejectCookies(page);
  await page.locator("main").getByLabel("Email", { exact: true }).fill("e2e-admin@wanderpaw.test");
  await page.getByLabel("Password").fill("E2E-admin-password-1");
  await page.getByRole("button", { name: "Sign in" }).click();

  // 2FA is mandatory for staff: after sign-in, /admin redirects to security setup.
  await expect(page).toHaveURL(/\/account\/security\?setup2fa=1/);
  await page.getByLabel("Confirm your password").fill("E2E-admin-password-1");
  await page.getByRole("button", { name: "Set up 2FA" }).click();
  const keyText = await page.getByText("Can't scan? Enter this key manually:").textContent();
  const secret = keyText!.split(":").pop()!.trim();
  await page.getByLabel("Verification code").fill(totp(secret));
  await page.getByRole("button", { name: /Verify/ }).click();
  await expect(page.getByText("Two-factor authentication is enabled.")).toBeVisible();

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByText(/Launch readiness/)).toBeVisible();

  await page.goto("/admin/orders");
  await page.getByRole("link", { name: orderNumber }).click();
  await expect(page.getByRole("heading", { name: `Order ${orderNumber}` })).toBeVisible();
  await page.getByRole("button", { name: "Submit to CJ" }).click();
  await expect(page.getByText(/Supplier order: MOCK-CJ-WP-/)).toBeVisible();
  await expect(page.getByText("Confirm prepaid inventory was used")).toBeVisible();

  await page.reload();
  await page.getByLabel("Mock status").selectOption("SHIPPED");
  await page.getByRole("button", { name: "Simulate CJ update" }).click();
  await expect(page.getByText(/Mock CJ order set to SHIPPED/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/MOCKTRACK/).first()).toBeVisible();

  await page.goto("/admin/inventory");
  await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible();

  await page.goto(guestOrderUrl);
  await expect(page.getByText("Shipment")).toBeVisible();
  await expect(page.getByText(/MOCKTRACK/)).toBeVisible();
});

test("customers cannot open the admin dashboard", async ({ page }) => {
  await page.goto("/account/register");
  await rejectCookies(page);
  await page.getByLabel("Name").fill("Casual Customer");
  await page.locator("main").getByLabel("Email", { exact: true }).fill("customer@example.com");
  await page.getByLabel("Password", { exact: true }).fill("customer-password-1");
  await page.getByLabel("Confirm password").fill("customer-password-1");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(/sent a verification link/)).toBeVisible();
  // Unverified accounts cannot sign in.
  await page.goto("/account/login");
  await page.locator("main").getByLabel("Email", { exact: true }).fill("customer@example.com");
  await page.getByLabel("Password").fill("customer-password-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/verify your email/)).toBeVisible();
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/account\/login/);
});
