// Production browser verification. Temporary credentials are passed via stdin.
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright");
const fixture = JSON.parse(readFileSync(0, "utf8"));
const base = process.env.QA_BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const errors = [];
async function context(cookie) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  if (cookie) {
    const separator = cookie.indexOf("=");
    await ctx.addCookies([{ name: cookie.slice(0, separator), value: cookie.slice(separator + 1), url: base, httpOnly: true, sameSite: "Lax" }]);
  }
  const page = await ctx.newPage(); page.setDefaultTimeout(30000);
  page.on("pageerror", (error) => errors.push(error.message));
  return { ctx, page };
}
async function open(page, path) { const response = await page.goto(base + path, { waitUntil: "networkidle" }); assert.equal(response.status(), 200, path); }
const bell = (page) => page.locator('summary[aria-label^="Уведомления:"]');
async function unread(page) { return Number((await bell(page).getAttribute("aria-label")).match(/\d+/)[0]); }
async function publicationOnSecondPage(page) {
  await page.getByRole("link", { name: "Далее →", exact: true }).click();
  await page.waitForURL(base + "/following?page=2");
  await page.locator(`main a[href="/articles/${fixture.slug}"]`).first().waitFor();
  await page.getByRole("link", { name: "← Назад", exact: true }).click();
  await page.waitForURL(base + "/following");
}
try {
  const reader = await context(), author = await context(fixture.authorCookie), guest = await context();
  const page = reader.page;
  await open(page, "/following");
  assert(new URL(page.url()).pathname === "/login");
  assert.equal(new URL(page.url()).searchParams.get("returnTo"), "/following");
  await page.getByLabel("Email", { exact: true }).fill(fixture.readerEmail);
  await page.getByLabel("Пароль", { exact: true }).fill(fixture.readerPassword);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await page.waitForURL(base + "/following"); await page.waitForLoadState("networkidle");
  await page.getByRole("heading", { name: "Лента подписок", exact: true }).waitFor();
  await publicationOnSecondPage(page);
  await open(page, `/profile/${fixture.username}`);
  await page.getByRole("button", { name: "Отписаться", exact: true }).click();
  await page.getByRole("button", { name: "Подписаться", exact: true }).waitFor();
  await open(page, "/following"); await page.getByText("Ваша лента пока пуста", { exact: true }).waitFor();
  await open(page, `/profile/${fixture.username}`);
  await page.getByRole("button", { name: "Подписаться", exact: true }).click();
  await page.getByRole("button", { name: "Отписаться", exact: true }).waitFor();
  await open(page, "/following");
  await publicationOnSecondPage(page);
  // Read state changes only after explicit action, never preview opening.
  const before = await unread(page); assert(before > 0);
  await bell(page).focus(); await page.keyboard.press("Enter");
  await page.getByRole("region", { name: "Последние уведомления" }).waitFor();
  assert.equal(await unread(page), before);
  await page.keyboard.press("Escape"); assert.equal(await bell(page).evaluate((e) => e === document.activeElement), true);
  assert.equal(await page.getByRole("region", { name: "Последние уведомления" }).isVisible(), false);
  await bell(page).click();
  await page.getByRole("link", { name: "Все уведомления →", exact: true }).click();
  await page.waitForURL(base + "/dashboard/notifications"); await page.waitForLoadState("networkidle");
  const item = page.locator("main [data-notification-id]").filter({ hasText: "Новое" }).first();
  const id = await item.getAttribute("data-notification-id");
  await item.getByRole("button").first().click();
  await page.waitForURL((url) => url.pathname !== "/dashboard/notifications");
  await page.waitForLoadState("networkidle");
  assert.equal(await unread(page), before - 1);
  await open(page, "/dashboard/notifications");
  await page.locator(`main [data-notification-id="${id}"]`).getByText("Прочитано", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Прочитать все", exact: true }).click();
  await page.getByText("Непрочитанных: 0", { exact: true }).waitFor();
  assert.equal(await unread(page), 0);
  await page.reload({ waitUntil: "networkidle" }); assert.equal(await unread(page), 0);
  await page.locator('summary[aria-label="Меню аккаунта"]').click();
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await page.waitForURL(base + "/login");
  await open(page, "/dashboard/notifications");
  await page.getByLabel("Email", { exact: true }).fill(fixture.readerEmail);
  await page.getByLabel("Пароль", { exact: true }).fill(fixture.readerPassword);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await page.waitForURL(base + "/dashboard/notifications"); await page.waitForLoadState("networkidle");
  assert.equal(await unread(page), 0);
  // An independently authenticated account retains its own unread history.
  await open(author.page, "/dashboard/notifications"); assert(await unread(author.page) > 0);
  const rejected = author.page.locator("main [data-notification-id]").filter({ hasText: "отклонена" }).first();
  await rejected.getByRole("button").first().click();
  await author.page.waitForURL((url) => url.pathname.startsWith("/dashboard/articles/") && url.searchParams.has("revision"));
  await author.page.waitForLoadState("networkidle");
  await author.page.getByText("Причина: Уточните содержание перед публикацией", { exact: true }).waitFor();
  await open(guest.page, "/dashboard/notifications");
  assert.equal(new URL(guest.page.url()).pathname, "/login");
  assert.equal(new URL(guest.page.url()).searchParams.get("returnTo"), "/dashboard/notifications");
  assert(!(await guest.page.content()).includes("data-notification-id"));
  mkdirSync(".playwright-mcp", { recursive: true });
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [name, path] of [["following", "/following"], ["notifications", "/dashboard/notifications"]]) {
      await open(page, path);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow: ${name} ${width}`);
      await page.screenshot({ path: `.playwright-mcp/phase7-${name}-${width}.png`, fullPage: true, animations: "disabled" });
    }
    await bell(page).click();
    const panel = page.getByRole("region", { name: "Последние уведомления" });
    await panel.waitFor(); const rect = await panel.boundingBox();
    assert(rect.x >= 0 && rect.x + rect.width <= width, `popover overflow ${width}`);
    await page.screenshot({ path: `.playwright-mcp/phase7-bell-${width}.png`, animations: "disabled" });
    await page.keyboard.press("Escape");
  }
  await open(page, "/following"); await page.keyboard.press("Tab");
  assert.equal(await page.locator(":focus").innerText(), "Перейти к содержимому");
  assert.deepEqual(errors, []);
  console.log("PASS notifications browser: real login/logout, follow/empty/feed/pagination, read state survives relogin, keyboard bell/Escape, preview without marking, open/read, mark all, recipient isolation, exact rejected revision, guest denial, 12 responsive views at 1440/768/390/320, no page errors");
} finally { await browser.close(); }
