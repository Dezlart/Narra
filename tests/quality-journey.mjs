import assert from "node:assert/strict";

export async function journey({ browser, fixture: f, base, open, context, result }) {
  const writer = await context(browser), reader = await context(browser, f.people[3]), moderator = await context(browser, f.people[1]);
  const saved = async page => {
    try {await page.getByText("Сохранено", { exact: true }).waitFor();}
    catch {throw new Error(`Save did not settle: ${await page.getByRole("status").allTextContents()}; ${await page.getByRole("alert").allTextContents()}`);}
  };
  const confirm = page => page.once("dialog", dialog => dialog.accept());
  async function login(page, email, password) {
    await open(page, "/login?returnTo=https%3A%2F%2Fevil.example");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Пароль", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    await page.waitForURL(base + "/dashboard");
  }
  async function submit(page) {
    confirm(page); await page.getByRole("button", { name: "Отправить на модерацию", exact: true }).click();
    await page.waitForURL(/\/dashboard\/articles\//);
  }
  async function review(title, reason) {
    await open(moderator.page, "/admin/moderation");
    await moderator.page.getByRole("link", { name: title, exact: true }).click();
    if(reason) await moderator.page.getByLabel("Причина отклонения").fill(reason);
    confirm(moderator.page);
    await moderator.page.getByRole("button", { name: reason ? "Отклонить версию" : "Одобрить и опубликовать", exact: true }).click();
    await moderator.page.getByRole("heading", { name: "Решение сохранено", exact: true }).waitFor();
  }
  // Registration, validation association, logout and real login through the UI.
  await open(writer.page, "/register");
  await writer.page.getByLabel("Имя", {exact:true}).fill(`Автор ${f.run}`);
  await writer.page.getByLabel("Username", {exact:true}).fill(f.registration.username);
  await writer.page.getByLabel("Email", {exact:true}).fill(f.registration.email);
  await writer.page.getByLabel("Пароль", {exact:true}).fill(f.registration.password);
  await writer.page.getByLabel("Подтвердите пароль", {exact:true}).fill("does-not-match");
  await writer.page.getByRole("button", {name:"Создать аккаунт",exact:true}).click();
  assert.equal(await writer.page.getByLabel("Подтвердите пароль",{exact:true}).getAttribute("aria-invalid"),"true");
  assert(await writer.page.getByLabel("Подтвердите пароль",{exact:true}).evaluate(e=>e===document.activeElement));
  await writer.page.getByLabel("Подтвердите пароль", {exact:true}).fill(f.registration.password);
  await writer.page.getByRole("button", {name:"Создать аккаунт",exact:true}).click();
  await writer.page.waitForURL(base+"/dashboard");
  await writer.page.getByLabel("Меню аккаунта",{exact:true}).click();
  await writer.page.keyboard.press("Escape");
  assert.equal(await writer.page.getByLabel("Меню аккаунта",{exact:true}).getAttribute("aria-expanded"),"false");
  assert(await writer.page.getByLabel("Меню аккаунта",{exact:true}).evaluate(e=>e===document.activeElement));
  await writer.page.getByLabel("Меню аккаунта",{exact:true}).click();
  await writer.page.getByRole("dialog",{name:"Аккаунт",exact:true}).getByRole("button",{name:"Выйти",exact:true}).click();
  await writer.page.waitForURL(base+"/login");
  await login(writer.page,f.registration.email,f.registration.password);
  await open(writer.page,"/editor/new");
  await writer.page.getByRole("button",{name:"Создать черновик",exact:true}).click();
  await writer.page.waitForURL(/\/editor\/(?!new)/);
  const editorPath = new URL(writer.page.url()).pathname, id = editorPath.split("/").at(-1);
  const title = `Путь читателя ${f.run}`;
  await writer.page.getByLabel("Заголовок",{exact:true}).fill(title);
  await writer.page.getByLabel("Краткое описание",{exact:true}).fill("Новая история проходит весь путь от черновика до читателя.");
  await writer.page.getByLabel("Категория",{exact:true}).selectOption(f.categoryId);
  const text = writer.page.getByRole("textbox",{name:"Текст статьи",exact:true});
  await text.fill("Содержательная история об исследовании города и людях. Здесь достаточно текста для настоящей публикации.");
  await saved(writer.page);
  await open(writer.page,editorPath);
  assert((await text.innerText()).includes("Содержательная история"));
  // Formatting, link focus/Escape, undo/redo and mobile layout.
  await text.focus();
  await writer.page.keyboard.press("Control+End");
  await writer.page.keyboard.type(" Проверка форматирования.");
  await writer.page.getByRole("button",{name:"Отменить",exact:true}).click();
  await writer.page.getByRole("button",{name:"Повторить",exact:true}).click();
  await writer.page.getByRole("button",{name:"Добавить ссылку",exact:true}).click();
  assert(await writer.page.getByLabel("Адрес ссылки для выделенного текста").evaluate(e=>e===document.activeElement));
  await writer.page.getByLabel("Адрес ссылки для выделенного текста").fill("javascript:alert(1)");
  await writer.page.getByRole("button",{name:"Применить",exact:true}).click();
  await writer.page.getByText("Введите полную ссылку",{exact:false}).waitFor();
  await writer.page.keyboard.press("Escape");
  assert(await writer.page.getByRole("button",{name:"Добавить ссылку",exact:true}).evaluate(e=>e===document.activeElement));
  await saved(writer.page);
  // Failed autosave preserves text and warns before leaving. Retry uses the server.
  await writer.ctx.setOffline(true);
  await writer.page.getByLabel("Краткое описание",{exact:true}).fill("Текст после потери соединения должен остаться в редакторе.");
  await writer.page.getByText("Ошибка сохранения",{exact:true}).waitFor();
  assert((await writer.page.getByLabel("Краткое описание",{exact:true}).inputValue()).includes("потери соединения"));
  writer.page.once("dialog",dialog=>dialog.dismiss());
  await writer.page.getByRole("link",{name:"Мои статьи",exact:true}).first().click();
  assert.equal(new URL(writer.page.url()).pathname,editorPath);
  await writer.ctx.setOffline(false);
  await writer.page.getByRole("button",{name:"Сохранить",exact:true}).click(); await saved(writer.page);
  // Two real tabs expose editVersion conflict without overwriting local text.
  const other = await writer.ctx.newPage();
  let mountSaves = 0;
  other.on("request", request => { if(request.method()==="POST" && request.headers()["next-action"]) mountSaves++; });
  await open(other,editorPath); await other.getByRole("textbox",{name:"Текст статьи",exact:true}).waitFor();
  // Exceed the real 1300ms debounce: simply opening a tab must not save.
  await other.waitForTimeout(1700);
  assert.equal(mountSaves,0,"Editor mount must not mutate the draft");
  await writer.page.bringToFront();
  await writer.page.getByLabel("Краткое описание",{exact:true}).fill("Изменения первой вкладки подтверждены сервером и не должны перезаписываться."); await saved(writer.page);
  await other.bringToFront();
  await other.getByLabel("Краткое описание",{exact:true}).fill("Локальная копия второй вкладки сохраняется при конфликте.");
  await other.getByText("Конфликт сохранения",{exact:true}).waitFor();
  assert((await other.getByLabel("Краткое описание",{exact:true}).inputValue()).includes("Локальная копия"));
  assert(await other.getByRole("button",{name:"Скачать копию текста"}).isVisible());
  await other.close();
  await submit(writer.page);
  const historyPath = `/dashboard/articles/${id}`;
  const reason = `Исправьте заключение. ${"Подробное замечание. ".repeat(25)}`.trim();
  await review(title,reason);
  await open(writer.page,historyPath);
  await writer.page.getByText(reason,{exact:false}).first().waitFor();
  await writer.page.getByRole("button",{name:"Исправить статью",exact:true}).click();
  await writer.page.waitForURL(base+editorPath);
  await writer.page.getByRole("textbox",{name:"Текст статьи",exact:true}).fill("Исправленная история о городе и людях. Заключение дополнено с учётом замечаний модератора.");
  await saved(writer.page); await submit(writer.page); await review(title);
  await open(writer.page,historyPath);
  const publicPath = await writer.page.locator('a[href^="/articles/"]').first().getAttribute("href");
  assert(publicPath);
  await open(reader.page,publicPath);
  await reader.page.getByRole("heading",{name:title,exact:true}).waitFor();
  // Failure must not leave a false successful social state or discard comments.
  await reader.page.route("**/*", route => route.request().method()==="POST" ? route.abort("failed") : route.continue());
  await reader.page.getByRole("button",{name:/^Нравится/}).click();
  await reader.page.getByText("Не удалось связаться с сервером. Попробуйте ещё раз.",{exact:true}).waitFor();
  assert.equal(await reader.page.getByRole("button",{name:/^Нравится/}).getAttribute("aria-pressed"),"false");
  await reader.page.getByLabel("Ваш комментарий",{exact:true}).fill("Комментарий сохраняется при сетевой ошибке.");
  await reader.page.getByRole("button",{name:"Отправить комментарий",exact:true}).click();
  await reader.page.getByText("Не удалось отправить комментарий",{exact:false}).waitFor();
  assert((await reader.page.getByLabel("Ваш комментарий",{exact:true}).inputValue()).includes("сетевой ошибке"));
  await reader.page.unroute("**/*");
  await reader.page.getByRole("button",{name:/^Нравится/}).click();
  await reader.page.getByRole("button",{name:/^Убрать лайк/}).waitFor();
  await reader.page.getByRole("button",{name:"Сохранить",exact:true}).click();
  await reader.page.getByRole("button",{name:"Убрать из закладок",exact:true}).waitFor();
  await reader.page.getByRole("button",{name:"Отправить комментарий",exact:true}).click();
  await reader.page.getByText("Комментарий сохраняется при сетевой ошибке.",{exact:true}).waitFor();
  await open(reader.page,`/profile/${f.registration.username}`);
  await reader.page.getByRole("button",{name:"Подписаться",exact:true}).click();
  await reader.page.getByRole("button",{name:"Отписаться",exact:true}).waitFor();
  await open(reader.page,"/following"); await reader.page.getByRole("link",{name:title,exact:true}).waitFor();
  await open(reader.page,"/dashboard/bookmarks"); await reader.page.getByRole("link",{name:title,exact:true}).waitFor();
  await open(writer.page,"/dashboard/notifications");
  assert((await writer.page.locator("main").innerText()).includes("прокомментировал"));
  // A new pending revision never changes the reader's current approved snapshot.
  await open(writer.page,historyPath);
  await writer.page.getByRole("button",{name:"Редактировать",exact:true}).click();
  await writer.page.waitForURL(base+editorPath);
  const nextTitle = `${title} — новая версия`;
  await writer.page.getByLabel("Заголовок",{exact:true}).fill(nextTitle); await saved(writer.page);
  await open(reader.page,publicPath); await reader.page.getByRole("heading",{name:title,exact:true}).waitFor();
  await submit(writer.page);
  await open(reader.page,publicPath); await reader.page.getByRole("heading",{name:title,exact:true}).waitFor();
  await review(nextTitle);
  await open(reader.page,publicPath); await reader.page.getByRole("heading",{name:nextTitle,exact:true}).waitFor();
  await open(writer.page,"/admin",404); await open(moderator.page,"/admin/users",404);
  // Better Auth rejects arbitrary origins and has no state-changing GET sign-out.
  const rejected = await writer.ctx.request.post(base+"/api/auth/sign-out",{headers:{Origin:"https://evil.example"},data:{}});
  assert.equal(rejected.status(),403);
  const unsafeGet = await writer.ctx.request.get(base+"/api/auth/sign-out"); assert([404,405].includes(unsafeGet.status()));
  await open(writer.page,"/dashboard");
  // Client bundles and layout shifts measured on fresh pages, not a warm editor tab.
  for(const [name,path,person] of [["home","/",null],["article",publicPath,null],["editor",`/editor/${f.draftId}`,f.people[2]]]) {
    const sample = await context(browser,person), assets=[];
    await sample.page.addInitScript(()=>{window.__narraCLS=0;new PerformanceObserver(list=>{for(const entry of list.getEntries()) if(!entry.hadRecentInput) window.__narraCLS+=entry.value;}).observe({type:"layout-shift",buffered:true});});
    const downloads=[];
    sample.page.on("response",response=>{if(response.request().resourceType()==="script") downloads.push(response.body().then(body=>assets.push({bytes:body.length,editor:/ProseMirror|tiptap/.test(body.toString())})).catch(()=>{}));});
    await open(sample.page,path); await Promise.all(downloads);
    const metrics=await sample.page.evaluate(()=>{
      const resources=performance.getEntriesByType("resource"),fonts=resources.filter(e=>/\.woff2/.test(e.name));
      return {cls:window.__narraCLS,fonts:fonts.length,duplicateFontRequests:fonts.length-new Set(fonts.map(e=>e.name)).size,requests:resources.length};
    });
    assert.equal(metrics.duplicateFontRequests,0,`${name} repeated a font request`);
    result.performance.push({name,...metrics,scriptBytes:assets.reduce((n,a)=>n+a.bytes,0),editorBundle:assets.some(a=>a.editor)});
    if(name!=="editor") assert(!assets.some(a=>a.editor),`${name} loaded editor code`);
    await sample.ctx.close();
  }
  result.journey = "PASS: registration/login, autosave/reopen/offline/conflict, rejection/correction, publication, social/comment retry, following/notifications, published revision isolation, CSRF, ownership and bundle isolation";
  const { investigateStreams } = await import("./quality-stream.mjs");
  result.streams = await investigateStreams({browser,fixture:f,base});
  const { unavailableDatabase } = await import("./quality-unavailable.mjs");
  result.unavailable = await unavailableDatabase({browser,fixture:f});
}
