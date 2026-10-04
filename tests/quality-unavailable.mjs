import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import assert from "node:assert/strict";

export async function unavailableDatabase({ browser, fixture }) {
  // A separate process receives a closed loopback port. The real .env and
  // development database are never modified, stopped or replaced.
  const url = new URL(process.env.DATABASE_URL); url.hostname="127.0.0.1"; url.port="1";
  const origin="http://localhost:3002";
  const child=spawn(process.execPath,["node_modules/next/dist/bin/next","start","-p","3002"],{env:{...process.env,DATABASE_URL:url.toString(),BETTER_AUTH_URL:origin},windowsHide:true,stdio:["ignore","pipe","pipe"]});
  let log=""; child.stdout.on("data",data=>{log+=data.toString();});child.stderr.on("data",data=>{log+=data.toString();});
  const ctx=await browser.newContext();
  try {
    const deadline=Date.now()+30000;
    while(!log.includes("Ready")) {if(child.exitCode!==null||Date.now()>deadline)throw new Error("Isolated fault server did not start");await new Promise(resolve=>setTimeout(resolve,100));}
    const page=await ctx.newPage();
    await page.goto(origin,{waitUntil:"networkidle"});
    await page.getByRole("heading",{name:"Не удалось загрузить страницу",exact:true}).waitFor();
    assert(!/Prisma|DATABASE_URL|ECONNREFUSED|stack trace|P1001/.test(await page.locator("body").innerText()));
    let refresh=0;page.on("request",request=>{if(request.url().includes("_rsc="))refresh++;});
    await page.getByRole("button",{name:"Попробовать снова",exact:true}).click();
    await page.waitForLoadState("networkidle");
    assert(refresh>0,"Retry must refetch the server, not only reset local state");
    const cookie=fixture.people[2].cookie,split=cookie.indexOf("=");
    await ctx.addCookies([{name:cookie.slice(0,split),value:cookie.slice(split+1),url:origin,httpOnly:true,sameSite:"Lax"}]);
    await page.goto(origin+"/dashboard",{waitUntil:"networkidle"});
    // Depending on Better Auth's failure handling, root or segment boundary wins.
    await page.getByRole("heading",{name:/Narra временно недоступна|Не удалось загрузить страницу/}).waitFor();
    assert(!/Prisma|DATABASE_URL|ECONNREFUSED|P1001/.test(await page.locator("body").innerText()));
    return {anonymousBoundary:"PASS",retryRefetch:"PASS",sessionStorageFailure:"PASS",rawDetails:"not exposed"};
  } finally {
    await ctx.close();child.kill();
    const password=decodeURIComponent(url.password);
    writeFileSync(".playwright-mcp/phase9-unavailable-server.log",password?log.split(password).join("[redacted]"):log);
  }
}
