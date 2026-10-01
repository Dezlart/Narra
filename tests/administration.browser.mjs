// Production browser QA; test credentials arrive only through stdin.
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const fixture = JSON.parse(readFileSync(0, 'utf8'));
const base = process.env.QA_BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE ? {executablePath:process.env.CHROMIUM_EXECUTABLE}: {})});
const errors=[];
async function context(user) {
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}});
 if(user){ const index=user.cookie.indexOf('='); await ctx.addCookies([{name:user.cookie.slice(0,index),value:user.cookie.slice(index+1),url:base,httpOnly:true,sameSite:'Lax'}]); }
 const page=await ctx.newPage();page.setDefaultTimeout(30000);page.on('pageerror', e=>errors.push(e.message));page.on('dialog', d=>d.accept());return {ctx,page};
}
async function open(page,path,status=200) {const r=await page.goto(base+path,{waitUntil:'networkidle'});assert.equal(r.status(),status,path);}
async function saved(page) {await page.getByRole('status').filter({hasText:'Сохранено.'}).first().waitFor();await page.waitForLoadState('networkidle');}
async function articleViews(author) {
 await open(author,'/dashboard/analytics');const row=author.locator('tr').filter({has:author.locator(`a[href="/articles/${fixture.slug}"]`)});
 return Number((await row.locator('td').nth(2).textContent()).trim());
}
try {
 const admin=await context(fixture.users[0]),mod=await context(fixture.users[1]),author=await context(fixture.users[2]),reader=await context(fixture.users[3]),guest=await context();
 await open(author.page,'/admin/users',404);await open(mod.page,'/admin/users',404);await open(mod.page,'/admin/categories',404);await open(mod.page,'/admin/articles',404);await open(mod.page,'/admin',404);
 await open(guest.page,'/admin/reports');assert.equal(new URL(guest.page.url()).pathname,'/login');
 await open(admin.page,'/admin');await admin.page.getByRole('heading',{name:'Платформа',exact:true}).waitFor();assert.equal(await admin.page.getByRole('navigation',{name:'Административная навигация'}).getByRole('link').count(),7);
 await admin.page.getByText('Данные графика в таблице',{exact:true}).click();assert.equal(await admin.page.locator('tbody tr').count(),14);
 await open(admin.page,'/admin/users');await admin.page.getByLabel('Имя, username или email').fill(fixture.users[3].email);await admin.page.getByRole('button',{name:'Найти',exact:true}).click();await admin.page.waitForLoadState('networkidle');
 let row=admin.page.locator('tbody tr');await row.getByText(fixture.users[3].email,{exact:true}).waitFor();assert.equal(await row.count(),1);
 await row.getByLabel(`Роль для Phase8 3 ${fixture.run}`).selectOption('MODERATOR');await row.getByRole('button',{name:'Изменить роль',exact:true}).click();await saved(admin.page);
 await open(reader.page,'/admin/reports');
 await row.getByLabel(`Роль для Phase8 3 ${fixture.run}`).selectOption('USER');await row.getByRole('button',{name:'Изменить роль',exact:true}).click();await saved(admin.page);
 await open(reader.page,'/admin/reports',404);
 // Cancel once to verify that confirmation prevents accidental ban.
 admin.page.removeAllListeners('dialog');admin.page.once('dialog', d=>d.dismiss());await row.getByRole('button',{name:'Заблокировать',exact:true}).click();assert.equal(await row.getByRole('button',{name:'Заблокировать',exact:true}).count(),1);
 admin.page.on('dialog',d=>d.accept());await row.getByRole('button',{name:'Заблокировать',exact:true}).click();await row.getByRole('button',{name:'Снять блокировку',exact:true}).waitFor();
 await open(reader.page,'/dashboard');assert.equal(new URL(reader.page.url()).pathname,'/login');
 await row.getByRole('button',{name:'Снять блокировку',exact:true}).click();await row.getByRole('button',{name:'Заблокировать',exact:true}).waitFor();
 await reader.page.getByLabel('Email',{exact:true}).fill(fixture.users[3].email);await reader.page.getByLabel('Пароль',{exact:true}).fill(fixture.users[3].password);await reader.page.getByRole('button',{name:'Войти',exact:true}).click();await reader.page.waitForURL(base+'/dashboard');
 await open(admin.page,'/admin/users?role=MODERATOR&state=active');assert((await admin.page.locator('tbody').textContent()).includes(fixture.users[1].email));assert(!(await admin.page.locator('tbody').textContent()).includes(fixture.users[3].email));
 await open(admin.page,'/admin/categories');await admin.page.getByText('Новая категория',{exact:true}).click();const form=admin.page.locator('details form');
 await form.getByLabel('Название',{exact:true}).fill(`Browser ${fixture.run}`);await form.getByLabel('Slug — латиница, цифры и дефисы',{exact:true}).fill(`qa-phase8-${fixture.run}-browser`);await form.getByLabel('Описание',{exact:true}).fill('Создано через настоящий интерфейс');await form.getByRole('button',{name:'Создать категорию'}).click();await saved(admin.page);
 const category=admin.page.locator('li').filter({has:admin.page.getByRole('heading',{name:`Browser ${fixture.run}`,exact:true})});await category.waitFor();
 await category.getByRole('button',{name:'Архивировать категорию',exact:true}).click();await category.getByRole('button',{name:'Восстановить категорию',exact:true}).waitFor();await category.getByRole('button',{name:'Восстановить категорию',exact:true}).click();await category.getByRole('button',{name:'Архивировать категорию',exact:true}).waitFor();
 const before=await articleViews(author.page);await open(guest.page,`/articles/${fixture.slug}`);const first=await articleViews(author.page);assert.equal(first,before+1);
 for(let i=0;i<3;i++) await guest.page.reload({waitUntil:'networkidle'});assert.equal(await articleViews(author.page),first);
 const anonymous=await guest.ctx.cookies();const visitor=anonymous.find(c=>c.name==='narra-view-visitor');assert(visitor?.httpOnly);assert.equal(visitor.sameSite,'Lax');assert(visitor.secure);
 const secondGuest=await context();await open(secondGuest.page,`/articles/${fixture.slug}`);assert.equal(await articleViews(author.page),first+1);
 await open(reader.page,`/articles/${fixture.slug}`);const report=reader.page.locator('header details').filter({has:reader.page.getByText('Пожаловаться',{exact:true})});await report.locator('summary').click();await report.getByLabel('Причина жалобы').selectOption('SPAM');await report.getByLabel('Описание (для «Другое» обязательно)').fill(`Browser report ${fixture.run}`);await report.getByRole('button',{name:'Отправить жалобу'}).click();await report.getByRole('status').waitFor();
 await open(mod.page,'/admin/reports');await mod.page.locator('tbody tr').filter({hasText:`Администрирование ${fixture.run}`}).first().getByRole('link').click();await mod.page.waitForLoadState('networkidle');await mod.page.getByText(`Browser report ${fixture.run}`,{exact:true}).waitFor();await mod.page.getByLabel('Решение',{exact:true}).selectOption('DISMISSED');await mod.page.getByRole('button',{name:'Подтвердить решение'}).click();await mod.page.getByText(/Рассмотрел:/).waitFor();
 const comment=author.page;await open(comment,`/articles/${fixture.slug}`);const thread=comment.locator(`#comment-${fixture.commentId}`);await thread.getByText('Пожаловаться',{exact:true}).click();await thread.getByLabel('Причина жалобы').selectOption('SPAM');await thread.getByRole('button',{name:'Отправить жалобу'}).click();await thread.getByRole('status').waitFor();
 await open(mod.page,'/admin/reports?targetType=COMMENT');await mod.page.locator('tbody tr').first().getByRole('link').click();await mod.page.getByLabel('Решение',{exact:true}).selectOption('HIDE_COMMENT');await mod.page.getByRole('button',{name:'Подтвердить решение'}).click();await mod.page.getByText(/Рассмотрел:/).waitFor();
 await open(guest.page,`/articles/${fixture.slug}`);assert(!(await guest.page.content()).includes(`Контекст жалобы ${fixture.run}`));
 await open(admin.page,`/admin/articles/${fixture.articleId}`);await admin.page.getByRole('button',{name:'Архивировать статью',exact:true}).click();await admin.page.getByRole('button',{name:'Восстановить публикацию',exact:true}).waitFor();await open(guest.page,`/articles/${fixture.slug}`,404);
 await admin.page.getByRole('button',{name:'Восстановить публикацию',exact:true}).click();await admin.page.getByRole('button',{name:'Архивировать статью',exact:true}).waitFor();await open(guest.page,`/articles/${fixture.slug}`);
 mkdirSync('.playwright-mcp',{recursive:true});
 for(const width of [1440,768,390,320]) {
  for(const [name,path,user] of [['overview','/admin',admin],['users',`/admin/users?q=${fixture.run}`,admin],['articles','/admin/articles',admin],['categories','/admin/categories',admin],['reports','/admin/reports?status=ALL',admin],['analytics','/dashboard/analytics',author]]) {
   await user.page.setViewportSize({width,height:950});await open(user.page,path);assert(await user.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${name} overflow ${width}`);
   await user.page.screenshot({path:`.playwright-mcp/phase8-${name}-${width}.png`,fullPage:true});
  }
 }
 await admin.page.keyboard.press('Tab');await admin.page.keyboard.press('Enter');assert(await admin.page.locator('#main-content').evaluate(e=>e===document.activeElement));
 assert.deepEqual(errors,[]);console.log('PHASE 8 browser PASS: admin roles/ban/confirmation, categories, reports, archive/restore, anonymous view dedup, analytics, 24 responsive views and keyboard.');
} finally {await browser.close();}
