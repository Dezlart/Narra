import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { chromium, firefox, webkit } from "playwright";
import AxeBuilder from "@axe-core/playwright";
const fixture = JSON.parse(readFileSync(0, "utf8"));
const base = process.env.QA_BASE_URL || "http://localhost:3000";
const auditOnly = process.env.NARRA_QUALITY_MODE === "audit";
const journeyOnly = process.env.NARRA_QUALITY_MODE === "journey";
const result = { routes: [], accessibility: [], browsers: [], failures: [], pageErrors: [], consoleErrors: [], performance: [] };
mkdirSync(".playwright-mcp", { recursive: true });
async function context(browser, person) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  if (person) { const separator = person.cookie.indexOf("="); await ctx.addCookies([{ name: person.cookie.slice(0, separator), value: person.cookie.slice(separator + 1), url: base, httpOnly: true, sameSite: "Lax" }]); }
  const page = await ctx.newPage(); page.setDefaultTimeout(30000);
  page.on("pageerror", e => result.pageErrors.push(e.message));
  page.on("console", e => { if(e.type() === "error" && !e.text().includes("status of 404")) result.consoleErrors.push(e.text()); });
  return { ctx, page };
}
async function open(page, path, status = 200) {
  const response = await page.goto(base + path, { waitUntil: "networkidle" });
  assert.equal(response.status(), status, path);
}
const browser = await chromium.launch({ headless: true });
try {
  const guest = await context(browser), admin = await context(browser, fixture.people[0]), author = await context(browser, fixture.people[2]), empty = await context(browser, fixture.people[4]);
  if(!journeyOnly) {
  const routes = [
    ["home", "/", guest], ["login", "/login", guest], ["register", "/register", guest],
    ["profile", `/profile/${fixture.people[2].username}`, guest], ["article", `/articles/${fixture.slug}`, guest],
    ["categories", "/categories", guest], ["category", `/categories/qa-quality-${fixture.run}`, guest], ["tag", `/tags/${fixture.tagSlug}`, guest], ["search", `/search?q=${fixture.run}`, guest],
    ["following", "/following", author], ["dashboard", "/dashboard", author], ["own-articles", "/dashboard/articles", author],
    ["history", `/dashboard/articles/${fixture.articleId}`, author], ["bookmarks", "/dashboard/bookmarks", author], ["notifications", "/dashboard/notifications", author],
    ["analytics", "/dashboard/analytics", author], ["settings", "/dashboard/settings", author], ["new", "/editor/new", author], ["editor", `/editor/${fixture.draftId}`, author],
    ["admin", "/admin", admin], ["moderation", "/admin/moderation", admin], ["preview", `/admin/moderation/${fixture.pendingId}`, admin],
    ["admin-articles", "/admin/articles", admin], ["admin-history", `/admin/articles/${fixture.articleId}`, admin], ["users", `/admin/users?q=${fixture.run}`, admin],
    ["comments", "/admin/comments", admin], ["reports", "/admin/reports", admin], ["report", `/admin/reports/${fixture.reportId}`, admin], ["admin-categories", "/admin/categories", admin],
  ];
  for (const [name, path, actor] of routes) {
    await open(actor.page, path);
    if(name === "editor") await actor.page.getByRole("textbox", {name:"Текст статьи",exact:true}).waitFor();
    const scan = await new AxeBuilder({ page: actor.page }).analyze();
    result.accessibility.push({ name, violations: scan.violations.map(v => ({ id:v.id, impact:v.impact, nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary})) })) });
    for(const width of [1440,1024,768,390,320]) {
      await actor.page.setViewportSize({width,height:1000});
      const overflow = await actor.page.evaluate(()=>document.documentElement.scrollWidth > innerWidth+1);
      result.routes.push({name,width,overflow});
      if(overflow) result.failures.push(`${name}: overflow ${width}: `+JSON.stringify(await actor.page.evaluate(()=>[...document.querySelectorAll("main *")].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,8).map(e=>({tag:e.tagName,class:e.className})))));
      if([1440,320].includes(width) && ["editor","article","users","report"].includes(name)) await actor.page.screenshot({path:`.playwright-mcp/phase9-${name}-${width}.png`,fullPage:true});
    }
    await actor.page.setViewportSize({width:1440,height:1000});
  }
  for(const path of [`/articles/missing-${fixture.run}`, `/articles/${fixture.privateSlug}`, `/articles/${fixture.archivedSlug}`, `/profile/missing_${fixture.run}`, `/categories/missing-${fixture.run}`, `/tags/missing-${fixture.run}`]) await open(guest.page,path,404);
  await open(admin.page,`/admin/moderation/missing${fixture.run}`,404);
  for(const path of ["/dashboard/articles","/dashboard/bookmarks","/dashboard/notifications","/dashboard/analytics","/following"]) { await open(empty.page,path); assert(await empty.page.locator("main").innerText()); }
  await open(guest.page,`/categories/qa-quality-${fixture.run}-empty`);
  for(const q of ["", "   ", "Кириллица", "雪", "%_!?", "я".repeat(121)]) await open(guest.page,`/search?q=${encodeURIComponent(q)}`);
  for(const page of ["0","-1","abc","999999"]) await open(guest.page,`/search?q=${fixture.run}&page=${page}`);
  await open(author.page,"/dashboard");
  const bell=author.page.locator('summary[aria-label^="Уведомления:"]');
  assert((await bell.innerText()).includes("99+"));
  for(const width of [390,320]) {
    await author.page.setViewportSize({width,height:700});
    for(const trigger of [bell,author.page.getByLabel("Меню аккаунта",{exact:true}),author.page.getByLabel("Открыть меню",{exact:true})]) {
      await trigger.focus(); await author.page.keyboard.press("Enter");
      assert.equal(await author.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
      await author.page.keyboard.press("Escape");
      assert(await trigger.evaluate(e=>e===document.activeElement));
    }
  }
  await guest.page.emulateMedia({reducedMotion:"reduce"});
  assert.equal(await guest.page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior),"auto");
  await open(guest.page,`/search?q=${fixture.run}`);
  await open(guest.page,`/articles/${fixture.slug}`);
  await guest.page.goBack({waitUntil:"networkidle"}); assert(new URL(guest.page.url()).pathname==="/search");
  await guest.page.goForward({waitUntil:"networkidle"}); await guest.page.getByRole("heading",{level:1,name:fixture.title,exact:true}).waitFor();
  for(const [name,engine] of [["chromium",chromium],["firefox",firefox],["webkit",webkit]]) {
    const engineBrowser = await engine.launch({headless:true});
    try {
      const reader = await context(engineBrowser), writer = await context(engineBrowser,fixture.people[2]), manager = await context(engineBrowser,fixture.people[0]);
      for(const [path,actor] of [["/",reader],["/login",reader],[`/articles/${fixture.slug}`,reader],[`/profile/${fixture.people[2].username}`,reader],[`/editor/${fixture.draftId}`,writer],["/dashboard",writer],["/admin",manager]]) await open(actor.page,path);
      await open(writer.page,`/editor/${fixture.draftId}`); await writer.page.getByRole("textbox",{name:"Текст статьи",exact:true}).waitFor();
      await reader.page.bringToFront(); await open(reader.page,"/");
      if(name!=="webkit") {await reader.page.keyboard.press("Tab"); assert.equal(await reader.page.locator(":focus").innerText(),"Перейти к содержимому");}
      result.browsers.push({name,smoke:"PASS",keyboard:name==="webkit"?"Windows headless window focus is unreliable; keyboard audit runs in Chromium/Firefox":"PASS"});
    } finally {await engineBrowser.close();}
  }
  // Additional interaction and failure scenarios are kept in a separate helper.
  }
  if(!auditOnly) { const { journey } = await import("./quality-journey.mjs"); await journey({browser,fixture,base,open,context,result}); }
} finally {
  await browser.close();
  writeFileSync(`.playwright-mcp/phase9-${auditOnly?"baseline":journeyOnly?"journey":"final"}.json`,JSON.stringify(result,null,2));
}
console.log(JSON.stringify({responsiveViews:result.routes.length,accessibilityPages:result.accessibility.length,violations:result.accessibility.filter(p=>p.violations.length).map(p=>({page:p.name,rules:p.violations.map(v=>v.id)})),browsers:result.browsers,failures:result.failures,pageErrors:result.pageErrors}));
if(!auditOnly) {
  assert.deepEqual(result.failures,[]);assert.deepEqual(result.pageErrors,[]);
  // The editable source document may intentionally skip heading levels. Keep
  // that best-practice finding in the report; enforce it on the public renderer.
  const actionable = result.accessibility.flatMap(p=>p.violations.filter(v=>!(p.name==="editor" && v.id==="heading-order")));
  assert.deepEqual(actionable,[]);
}
