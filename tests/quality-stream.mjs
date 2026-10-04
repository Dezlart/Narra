import { readFileSync } from "node:fs";

export async function investigateStreams({ browser, fixture, base }) {
  const log = process.env.QA_SERVER_LOG || ".playwright-mcp/phase9-server.log";
  const warnings = () => (readFileSync(log,"utf8").match(/destination stream closed early/g)||[]).length;
  const initial = warnings();
  const ctx = await browser.newContext();
  const normal = await ctx.newPage();
  for(let i=0;i<5;i++) await normal.goto(`${base}/articles/${fixture.slug}`,{waitUntil:"networkidle"});
  const afterNormal = warnings();
  let cancelled = 0;
  for(let i=0;i<8;i++) {
    const page = await ctx.newPage();
    const action = page.waitForRequest(request=>request.method()==="POST" && Boolean(request.headers()["next-action"]));
    await page.goto(`${base}/articles/${fixture.slug}`,{waitUntil:"domcontentloaded"});
    await action;
    await page.close();
    cancelled++;
  }
  await new Promise(resolve=>setTimeout(resolve,1500));
  const afterCancelled = warnings();
  await normal.goto(`${base}/articles/${fixture.slug}`,{waitUntil:"networkidle"});
  await ctx.close();
  return {normalNavigations:5,normalWarnings:afterNormal-initial,cancelledActionPages:cancelled,cancelledWarnings:afterCancelled-afterNormal,recovery:"PASS"};
}
