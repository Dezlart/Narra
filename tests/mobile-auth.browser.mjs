import assert from "node:assert/strict";
import { chromium, devices, webkit } from "playwright";

const fixture = JSON.parse(process.argv[2]);
const mode = process.argv[3];

function cookieFor(base, value) {
  const separator = value.indexOf("=");
  return { name: value.slice(0, separator), value: value.slice(separator + 1), url: base, httpOnly: true, sameSite: "Lax" };
}

async function createContext(browser, options, authenticated) {
  const context = await browser.newContext(options);
  if (authenticated) await context.addCookies([cookieFor(fixture.base, fixture.cookie)]);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return { context, page, errors };
}

async function assertActorState(page, authenticated) {
  if (authenticated) await page.getByRole("button", { name: "Меню аккаунта", exact: true }).waitFor();
  else await page.getByRole("link", { name: "Войти", exact: true }).waitFor();
}

async function submitSearch(page, method, authenticated) {
  await page.goto(`${fixture.base}/search`, { waitUntil: "networkidle" });
  await assertActorState(page, authenticated);
  const input = page.getByRole("searchbox", { name: "Название, описание или автор", exact: true });
  await input.fill(fixture.query);
  if (method === "button") await page.getByRole("button", { name: "Найти", exact: true }).click();
  else await input.press("Enter");
  await page.waitForURL((url) => url.pathname === "/search" && url.searchParams.get("q") === fixture.query);
  await page.getByRole("heading", { name: `Результаты для «${fixture.query}»`, exact: true }).waitFor();
  assert.equal(await input.inputValue(), fixture.query);
  await page.locator(`main a[href="/articles/${fixture.slug}"]`).first().waitFor();
  return await page.locator('main a[href^="/articles/"]').evaluateAll((links) =>
    [...new Set(links.map((link) => link.getAttribute("href")).filter(Boolean))].sort());
}

async function searchMatrix() {
  const chromiumBrowser = await chromium.launch({ headless: true });
  const webkitBrowser = await webkit.launch({ headless: true });
  const scenarios = [
    ["desktop-chromium-guest", chromiumBrowser, { viewport: { width: 1440, height: 900 } }, false],
    ["desktop-chromium-auth", chromiumBrowser, { viewport: { width: 1440, height: 900 } }, true],
    ["mobile-chromium-guest", chromiumBrowser, { ...devices["Pixel 7"] }, false],
    ["mobile-chromium-auth", chromiumBrowser, { ...devices["Pixel 7"] }, true],
    ["mobile-webkit-guest", webkitBrowser, { ...devices["iPhone 13"] }, false],
    ["mobile-webkit-auth", webkitBrowser, { ...devices["iPhone 13"] }, true],
  ];
  let baseline;
  try {
    for (const [name, browser, options, authenticated] of scenarios) {
      const actor = await createContext(browser, options, authenticated);
      try {
        for (const method of ["button", "enter"]) {
          const results = await submitSearch(actor.page, method, authenticated);
          baseline ??= results;
          assert.deepEqual(results, baseline, `${name}/${method} returned different public articles`);
        }
        assert.deepEqual(actor.errors, [], `${name} emitted page errors`);
      } finally { await actor.context.close(); }
    }
  } finally {
    await chromiumBrowser.close();
    await webkitBrowser.close();
  }
  console.log("PASS search parity: desktop/mobile Chromium and iPhone WebKit, guest/auth, button/Enter, identical q and public results");
}

async function openMobileNavigation(page) {
  const trigger = page.getByRole("button", { name: "Открыть меню", exact: true });
  await trigger.tap();
  const navigation = page.getByRole("navigation", { name: "Мобильная навигация", exact: true });
  await navigation.waitFor();
  return { trigger, navigation };
}

async function navigationMatrix() {
  const chromiumBrowser = await chromium.launch({ headless: true });
  const webkitBrowser = await webkit.launch({ headless: true });
  const scenarios = [
    ["chromium-guest", chromiumBrowser, { ...devices["Pixel 7"] }, false],
    ["chromium-auth", chromiumBrowser, { ...devices["Pixel 7"] }, true],
    ["webkit-guest", webkitBrowser, { ...devices["iPhone 13"] }, false],
    ["webkit-auth", webkitBrowser, { ...devices["iPhone 13"] }, true],
  ];
  const items = [["Главная", "/"], ["Категории", "/categories"], ["Поиск", "/search"], ["Подписки", "/following"]];
  try {
    for (const [name, browser, options, authenticated] of scenarios) {
      const actor = await createContext(browser, options, authenticated);
      try {
        for (const [label, href] of items) {
          await actor.page.goto(`${fixture.base}${href === "/" ? "/categories" : "/"}`, { waitUntil: "networkidle" });
          await assertActorState(actor.page, authenticated);
          const { navigation } = await openMobileNavigation(actor.page);
          const link = navigation.getByRole("link", { name: label, exact: true });
          assert.equal(await link.getAttribute("href"), href);
          await link.tap();
          if (href === "/following" && !authenticated) {
            await actor.page.waitForURL((url) => url.pathname === "/login" && url.searchParams.get("returnTo") === "/following");
          } else await actor.page.waitForURL((url) => url.pathname === href);
          await navigation.waitFor({ state: "hidden" });
        }

        await actor.page.goto(fixture.base, { waitUntil: "networkidle" });
        let state = await openMobileNavigation(actor.page);
        await actor.page.keyboard.press("Escape");
        await state.navigation.waitFor({ state: "hidden" });
        await actor.page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Открыть меню");

        state = await openMobileNavigation(actor.page);
        await actor.page.locator("main").tap({ position: { x: 8, y: 8 } });
        await state.navigation.waitFor({ state: "hidden" });

        if (!authenticated) {
          state = await openMobileNavigation(actor.page);
          const registration = state.navigation.getByRole("link", { name: "Регистрация", exact: true });
          assert.equal(await registration.getAttribute("href"), "/register");
          await registration.tap();
          await actor.page.waitForURL((url) => url.pathname === "/register");
        }
        assert.deepEqual(actor.errors, [], `${name} emitted page errors`);
      } finally { await actor.context.close(); }
    }
  } finally {
    await chromiumBrowser.close();
    await webkitBrowser.close();
  }
  console.log("PASS mobile navigation: Chromium/WebKit, guest/auth, all links, registration, Escape, outside dismissal, focus return");
}

async function visualMatrix() {
  const browser = await chromium.launch({ headless: true });
  const widths = [1440, 1024, 768, 390, 320];
  try {
    for (const width of widths) {
      const actor = await createContext(browser, { viewport: { width, height: width <= 390 ? 844 : 900 } }, true);
      try {
        for (const path of ["/", "/categories", "/dashboard"]) {
          await actor.page.goto(`${fixture.base}${path}`, { waitUntil: "networkidle" });
          await assertActorState(actor.page, true);
          const dimensions = await actor.page.evaluate(() => ({ viewport: window.innerWidth, content: document.documentElement.scrollWidth }));
          assert.ok(dimensions.content <= dimensions.viewport, `${width}:${path} has horizontal overflow (${dimensions.content} > ${dimensions.viewport})`);
          if (path === "/categories") assert.equal((await actor.page.locator("main").innerText()).includes("↗"), false);
          if (path === "/dashboard") {
            for (const label of ["Моя аналитика", "Сохранённые", "Лента подписок", "Уведомления"]) {
              await actor.page.getByRole("link", { name: new RegExp(label) }).waitFor();
            }
          }
          if (process.env.NARRA_CAPTURE_QA === "1" && (width === 1440 || width === 390)) {
            const pageName = path === "/" ? "home" : path.slice(1);
            await actor.page.screenshot({ path: `.next/qa-${pageName}-${width}.png`, fullPage: true });
          }
        }
        assert.deepEqual(actor.errors, [], `${width}px visual smoke emitted page errors`);
      } finally { await actor.context.close(); }
    }
  } finally { await browser.close(); }
  console.log("PASS responsive UI: home, categories and authenticated dashboard at 1440/1024/768/390/320 without overflow");
}

if (mode === "search") await searchMatrix();
else if (mode === "navigation") await navigationMatrix();
else if (mode === "visual") await visualMatrix();
else throw new Error(`Unknown mobile/auth browser mode: ${mode}`);
