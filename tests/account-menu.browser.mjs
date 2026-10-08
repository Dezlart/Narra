import assert from "node:assert/strict";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const fixture = JSON.parse(process.argv[2]);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const separator = fixture.cookie.indexOf("=");
await context.addCookies([{
  name: fixture.cookie.slice(0, separator),
  value: fixture.cookie.slice(separator + 1),
  url: fixture.base,
  httpOnly: true,
  sameSite: "Lax",
}]);
const page = await context.newPage();
const errors = [];
let crashed = false;
page.on("pageerror", (error) => errors.push(error.message));
page.on("crash", () => { crashed = true; });

try {
  await page.goto(fixture.base, { waitUntil: "networkidle" });
  const trigger = page.locator('button[aria-label="Меню аккаунта"]');
  assert.equal(await trigger.evaluate((element) => element.tagName), "BUTTON");
  assert.equal(await trigger.evaluate((element) => Boolean(element.closest("details"))), false);

  await trigger.click();
  const menu = page.getByRole("dialog", { name: "Аккаунт", exact: true });
  await menu.waitFor();
  const accessibility = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  assert.deepEqual(accessibility.violations, []);
  const box = await menu.boundingBox();
  assert(box);
  for (const position of [
    { x: 2, y: 24 },
    { x: box.width - 2, y: 24 },
    { x: 2, y: box.height - 24 },
    { x: box.width - 2, y: box.height - 24 },
  ]) {
    await menu.click({ position });
    assert.equal(page.isClosed(), false);
    assert.equal(crashed, false);
    assert.equal(await menu.isVisible(), true);
    assert.equal(await trigger.getAttribute("aria-expanded"), "true");
  }

  // The transparent pixel inside a rounded bounding-box corner is an outside
  // click in Chromium. Closing there is valid, but the page must stay alive.
  await page.mouse.click(box.x + 1, box.y + 1);
  assert.equal(page.isClosed(), false);
  assert.equal(crashed, false);
  if (!await menu.isVisible()) {
    await trigger.click();
    await menu.waitFor();
  }

  await page.screenshot({ path: ".playwright-mcp/account-menu-regression.png", animations: "disabled" });
  await menu.getByRole("link", { name: "Личный кабинет", exact: true }).click();
  await page.waitForURL(fixture.base + "/dashboard");

  await trigger.focus();
  await page.keyboard.press("Enter");
  await menu.waitFor();
  await page.keyboard.press("Escape");
  await menu.waitFor({ state: "hidden" });
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Меню аккаунта");
  assert.equal(await trigger.evaluate((element) => element === document.activeElement), true);

  await trigger.click();
  await menu.waitFor();
  await page.locator("main").click({ position: { x: 8, y: 8 } });
  await menu.waitFor({ state: "hidden" });
  assert.equal(page.isClosed(), false);
  assert.equal(crashed, false);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileTrigger = page.getByLabel("Открыть меню", { exact: true });
  await mobileTrigger.click();
  const mobileNavigation = page.getByRole("navigation", { name: "Мобильная навигация", exact: true });
  await mobileNavigation.waitFor();
  await page.keyboard.press("Escape");
  await mobileNavigation.waitFor({ state: "hidden" });
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Открыть меню");

  assert.deepEqual(errors, []);
  console.log("PASS account menu: edge clicks, dashboard navigation, Escape focus return, outside dismissal, mobile popover, no page crash");
} finally {
  await browser.close();
}
