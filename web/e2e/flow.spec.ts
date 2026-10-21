import { expect, test, type Page } from "@playwright/test";

const DISCLAIMER =
  "This shows published generic names and indicative prices for medicines already named. It is not medical advice and it is not a recommendation to substitute. Confirm the medicine, the strength, and the price with your doctor or pharmacist before you buy or change anything.";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function startTyped(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Type medicine names" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Check the medicine names" })).toBeVisible();
}

async function addConfirmed(page: Page, name: string) {
  await page.getByLabel("Medicine name").fill(name);
  await page.getByRole("button", { name: "Add medicine" }).click();
  await page.getByRole("button", { name: new RegExp(`This name is correct: ${name}`) }).click();
}

async function confirmPatient(page: Page) {
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Age in years").fill("34");
  await page.getByRole("radio", { name: "Female" }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Yes, continue" }).click();
}

test("typed entry still confirms a medicine while offline", async ({ page, context }) => {
  await startTyped(page);
  await context.setOffline(true);
  await expect(page.getByText("You're offline. Typing medicines still works. Scanning needs internet.")).toBeVisible();
  await addConfirmed(page, "Calpol 500");
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  await expect(page.getByText(/₹/)).toHaveCount(0);
  await context.setOffline(false);
});

test("uncertain names show no price until a dataset row is chosen", async ({ page }) => {
  await startTyped(page);
  await page.getByLabel("Medicine name").fill("Crosin");
  await page.getByRole("button", { name: "Add medicine" }).click();
  await expect(page.getByText("Not certain")).toBeVisible();
  await expect(page.getByText(/₹/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await page.getByRole("button", { name: /Did you mean Calpol 500/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await confirmPatient(page);
  await expect(page.getByText("₹32.50").first()).toBeVisible();
});

test("two confirmed medicines add into one total", async ({ page }) => {
  await startTyped(page);
  await addConfirmed(page, "Calpol 500");
  await addConfirmed(page, "Dolo 650");
  await confirmPatient(page);
  await expect(page.getByText("₹66.50").first()).toBeVisible();
  await expect(page.getByText("₹12.50").first()).toBeVisible();
  await expect(page.getByText("PMBJP Price List 2024 / NPPA").first()).toBeVisible();
  await expect(page.getByText("Price date: not in this dataset.").first()).toBeVisible();
  await expect(page.getByText("Not in our data. Please ask your pharmacist or doctor.").first()).toBeVisible();
  await expect(page.getByText(DISCLAIMER).first()).toBeVisible();
});

test("mock scan lands on review with demo text", async ({ page }) => {
  await page.goto("/scan");
  await page.locator("input[type=file]").setInputFiles({ name: "slip.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByRole("heading", { level: 1, name: "Check the medicine names" })).toBeVisible();
  await expect(page.getByText("Calpol 500").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Text read from the image" })).toBeVisible();
  await expect(page.getByText("Demo data").first()).toBeVisible();
});

test("ocr failures offer typing", async ({ page }) => {
  const cases = [
    { status: 413, code: "FILE_TOO_LARGE", text: "too large" },
    { status: 415, code: "UNSUPPORTED_IMAGE", text: "JPG, PNG, or WebP" },
    { status: 429, code: "RATE_LIMITED", text: "Too many scans" },
    { status: 502, code: "OCR_BAD_OUTPUT", text: "could not be read" },
    { status: 503, code: "OCR_UNAVAILABLE", text: "unavailable" },
    { status: 504, code: "OCR_TIMEOUT", text: "too long" },
  ];
  for (const item of cases) {
    await page.route("**/v1/ocr", (route) =>
      route.fulfill({
        status: item.status,
        headers: item.status === 429 ? { "Retry-After": "2", "content-type": "application/json" } : { "content-type": "application/json" },
        body: JSON.stringify({ request_id: "req-12345678", error: { code: item.code, message: "x", fallback: "manual_entry" } }),
      }),
    );
    await page.goto("/scan?ocr=gemma");
    await page.locator("input[type=file]").setInputFiles({ name: "slip.jpg", mimeType: "image/jpeg", buffer: Buffer.from([1, 2, 3]) });
    await expect(page.locator("[role=alert]").filter({ hasText: item.text })).toBeVisible();
    await expect(page.getByRole("button", { name: "Type medicine names instead" })).toBeEnabled();
    await page.unroute("**/v1/ocr");
  }
});

test("ocr network failure and client timeout offer typing", async ({ page }) => {
  await page.route("**/v1/ocr", (route) => route.abort("failed"));
  await page.goto("/scan?ocr=gemma");
  await page.locator("input[type=file]").setInputFiles({ name: "slip.jpg", mimeType: "image/jpeg", buffer: Buffer.from([1, 2, 3]) });
  await expect(page.locator("[role=alert]").filter({ hasText: "connection failed" })).toBeVisible();
  await page.unroute("**/v1/ocr");

  await page.route("**/v1/ocr", () => new Promise(() => undefined));
  await page.goto("/scan?ocr=gemma&ocrTimeout=200");
  await page.locator("input[type=file]").setInputFiles({ name: "slip.jpg", mimeType: "image/jpeg", buffer: Buffer.from([1, 2, 3]) });
  await expect(page.locator("[role=alert]").filter({ hasText: "too long" })).toBeVisible({ timeout: 10_000 });
});

test("kendra permission, pin, and empty list", async ({ page, context }) => {
  await page.goto("/kendras");
  await page.getByLabel("PIN code").fill("110001");
  await page.getByRole("button", { name: "Look up PIN" }).click();
  await expect(page.getByText("Shastri Bhawan")).toBeVisible();

  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 28.61, longitude: 77.2 });
  await page.getByRole("button", { name: "Use this device's location" }).click();
  await expect(page.getByText("This list has no map coordinates")).toBeVisible();
});

test("print sheet hides controls and keeps the disclaimer", async ({ page }) => {
  await startTyped(page);
  await addConfirmed(page, "Calpol 500");
  await confirmPatient(page);
  await page.getByRole("link", { name: "Print", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Counter sheet" })).toBeVisible();
  await expect(page.getByText(DISCLAIMER).first()).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("button", { name: "Print this sheet" })).toBeHidden();
  await expect(page.locator(".print-sheet").getByText("Demo data")).toHaveCount(0);
  const pdf = await page.pdf({ printBackground: true });
  expect(pdf.byteLength).toBeGreaterThan(500);
});
