// Optional production-browser QA, invoked by social.integration.test.ts.
// Session cookies arrive over stdin and are never written to disk or logs.
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright");
const fixture = JSON.parse(readFileSync(0, "utf8"));
const base = process.env.QA_BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const errors = [];
const articlePath = `/articles/${fixture.slug}`;
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
async function clickAndWait(page, before, after) {
  await page.getByRole("button", { name: before, exact: false }).click();
  await page.getByRole("button", { name: after, exact: false }).waitFor();
  await page.waitForLoadState("networkidle");
}
try {
  const reader = await context(fixture.readerCookie), guest = await context(), moderator = await context(fixture.moderatorCookie);
  const page = reader.page;
  await open(page, articlePath);
  await clickAndWait(page, "Убрать лайк", "Нравится");
  await clickAndWait(page, "Нравится", "Убрать лайк");
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.getByRole("button", { name: /Убрать лайк/ }).getAttribute("aria-pressed"), "true");
  await clickAndWait(page, "Убрать лайк", "Нравится");
  await clickAndWait(page, "Убрать из закладок", "Сохранить");
  await clickAndWait(page, "Сохранить", "Убрать из закладок");
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Убрать из закладок", exact: true }).waitFor();
  await open(page, "/dashboard/bookmarks");
  assert.equal(await page.locator("main article").count(), 1);
  await page.getByRole("button", { name: "Убрать из закладок", exact: true }).click();
  await page.getByText("У вас пока нет сохранённых статей", { exact: true }).waitFor();
  await open(page, `/profile/${fixture.username}`);
  await clickAndWait(page, "Отписаться", "Подписаться");
  await clickAndWait(page, "Подписаться", "Отписаться");
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Отписаться", exact: true }).waitFor();
  assert.match(await page.locator("main").innerText(), /1 подписчиков/);
  await clickAndWait(page, "Отписаться", "Подписаться");
  assert.match(await page.locator("main").innerText(), /0 подписчиков/);
  await open(page, articlePath);
  const marker = `Browser comment ${fixture.run}`;
  const text = `${marker} <img src=x onerror=alert(1)>`;
  await page.getByLabel("Ваш комментарий", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Отправить комментарий", exact: true }).click();
  await page.getByText(text, { exact: true }).waitFor();
  const root = page.locator("#comments > ul > li").filter({ hasText: text });
  const commentId = (await root.locator('[id^="comment-"]').getAttribute("id")).slice(8);
  assert.equal(await root.locator("img").count(), 0, "comment plain text escaping");
  await open(guest.page, articlePath);
  await guest.page.getByText(text, { exact: true }).waitFor();
  assert.equal(await guest.page.getByLabel("Ваш комментарий", { exact: true }).count(), 0);
  const guestLike = guest.page.getByRole("link", { name: /Нравится/ });
  assert.equal(await guestLike.getAttribute("href"), `/login?returnTo=${encodeURIComponent(articlePath)}`);
  await guestLike.click(); await guest.page.waitForURL("**/login?returnTo=*");
  const protectedResponse = await guest.ctx.request.get(base + "/dashboard/bookmarks");
  assert.match(protectedResponse.url(), /\/login\?returnTo=/);
  await page.waitForTimeout(5100); // Exercise the real five-second comment interval.
  await root.getByRole("button", { name: "Ответить", exact: true }).click();
  const replyText = `Browser reply ${fixture.run}`;
  await root.getByLabel("Ваш ответ", { exact: true }).fill(replyText);
  await root.getByRole("button", { name: "Отправить ответ", exact: true }).click();
  await root.getByText(replyText, { exact: true }).waitFor();
  await open(moderator.page, `/admin/comments?commentId=${commentId}`);
  await moderator.page.getByRole("button", { name: "Скрыть", exact: true }).click();
  await moderator.page.getByRole("button", { name: "Подтвердить", exact: true }).click();
  await moderator.page.getByRole("button", { name: "Восстановить", exact: true }).waitFor();
  await open(guest.page, articlePath);
  assert(!(await guest.page.content()).includes(marker), "hidden content leaked into HTML/Flight");
  assert.equal(await guest.page.getByText(text, { exact: true }).count(), 0);
  await guest.page.getByText("Комментарий скрыт.", { exact: true }).waitFor();
  const hiddenRoot = guest.page.locator("#comments > ul > li").filter({ has: guest.page.locator(`#comment-${commentId}`) });
  await hiddenRoot.getByRole("button", { name: "Показать ответы", exact: true }).click();
  await hiddenRoot.getByText(replyText, { exact: true }).waitFor();
  await moderator.page.getByRole("button", { name: "Восстановить", exact: true }).click();
  await moderator.page.getByRole("button", { name: "Подтвердить", exact: true }).click();
  await moderator.page.getByRole("button", { name: "Скрыть", exact: true }).waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText(text, { exact: true }).waitFor();
  await root.getByRole("button", { name: "Показать ответы", exact: true }).click();
  await root.getByText(replyText, { exact: true }).waitFor();
  await root.locator(`#comment-${commentId}`).getByRole("button", { name: "Удалить", exact: true }).click();
  await root.getByRole("button", { name: "Да, удалить", exact: true }).click();
  const deletedRoot = page.locator("#comments > ul > li").filter({ has: page.locator(`#comment-${commentId}`) });
  await deletedRoot.getByText("Комментарий удалён автором.", { exact: true }).waitFor();
  await deletedRoot.getByText(replyText, { exact: true }).waitFor();
  await page.reload({ waitUntil: "networkidle" });
  assert(!(await page.content()).includes(marker), "deleted content leaked");
  await deletedRoot.getByRole("button", { name: "Показать ответы", exact: true }).click();
  const replyNode = deletedRoot.locator('div[aria-label="Ответы"] li').filter({ hasText: replyText });
  await replyNode.getByRole("button", { name: "Удалить", exact: true }).click();
  await replyNode.getByRole("button", { name: "Да, удалить", exact: true }).click();
  await deletedRoot.locator('div[aria-label="Ответы"]').getByText("Комментарий удалён автором.", { exact: true }).waitFor();
  mkdirSync(".playwright-mcp", { recursive: true });
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [name, path] of [["article", articlePath], ["bookmarks", "/dashboard/bookmarks"], ["profile", `/profile/${fixture.username}`]]) {
      await open(page, path);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow: ${name} ${width}`);
      await page.screenshot({ path: `.playwright-mcp/phase6-${name}-${width}.png`, fullPage: true, animations: "disabled" });
    }
    await moderator.page.setViewportSize({ width, height: 1000 });
    await open(moderator.page, `/admin/comments?commentId=${commentId}`);
    assert(await moderator.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `moderation overflow ${width}`);
  }
  await open(page, articlePath);
  await page.keyboard.press("Tab"); assert.equal(await page.locator(":focus").innerText(), "Перейти к содержимому");
  await page.keyboard.press("Enter");
  assert.deepEqual(errors, []);
  console.log("PASS social browser: likes/bookmarks/follows persist, guest login return, comments/replies/delete, moderator hide/restore/privacy, 16 responsive views at 1440/768/390/320, keyboard, no page errors");
} finally { await browser.close(); }
