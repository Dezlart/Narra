import "dotenv/config";
import { randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getAuth } from "@/lib/auth/server";
import { getPrisma } from "@/lib/prisma";
import { createArticleDraft, getArticleDraftById, updateArticleDraft } from "@/features/articles/service";
import { approveArticleRevision, submitArticleForModeration } from "@/features/moderation/service";
import { searchPublishedArticles } from "@/features/public-content/queries";

const db = getPrisma();
const run = randomBytes(6).toString("hex");
const base = "http://127.0.0.1:3108";
const ip = `198.18.${parseInt(run.slice(0, 2), 16)}.${parseInt(run.slice(2, 4), 16)}`;
const query = `единый мобильный поиск ${run}`;
const emails = [0, 1].map((index) => `narra-mobile-${run}-${index}@example.test`);
const passwords = emails.map(() => randomBytes(24).toString("base64url"));
const people: { id: string; cookie: string }[] = [];
let server: ChildProcess | undefined;
let categoryId = "", articleId = "", slug = "";
const headers = (index: number) => new Headers({ cookie: people[index].cookie });

async function waitForServer() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try { if ((await fetch(base)).ok) return; } catch { /* Server is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Narra production server did not start for mobile/auth regression.");
}

function runBrowser(mode: "search" | "navigation" | "visual") {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ["tests/mobile-auth.browser.mjs", JSON.stringify({ base, query, slug, cookie: people[0].cookie }), mode], {
      cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "", error = "";
    child.stdout?.on("data", (chunk) => { output += String(chunk); });
    child.stderr?.on("data", (chunk) => { error += String(chunk); });
    child.on("exit", (code) => code === 0 ? (console.log(output.trim()), resolve()) : reject(new Error(error || output)));
  });
}

beforeAll(async () => {
  process.env.BETTER_AUTH_URL = base;
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3108"], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: "production", BETTER_AUTH_URL: base, SITE_URL: "", VERCEL: "", VERCEL_ENV: "" },
    stdio: "ignore",
  });
  await waitForServer();
  for (let index = 0; index < 2; index++) {
    const response = await getAuth().handler(new Request(`${base}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { origin: base, "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ name: index ? "Модератор" : "Павел", username: `mobile_${run}_${index}`, email: emails[index], password: passwords[index] }),
    }));
    expect(response.status).toBe(200);
    const user = await db.user.findUniqueOrThrow({ where: { email: emails[index] }, select: { id: true } });
    const cookie = response.headers.getSetCookie().map((value) => value.split(";")[0]).find((value) => value.includes("session_token=")) ?? "";
    expect(cookie).not.toBe("");
    people.push({ ...user, cookie });
  }
  await db.user.update({ where: { id: people[1].id }, data: { role: "MODERATOR" } });
  categoryId = (await db.category.create({ data: { name: `Mobile ${run}`, slug: `mobile-${run}` } })).id;
  articleId = (await createArticleDraft(headers(0))).articleId;
  const draft = (await getArticleDraftById(articleId, headers(0))).draft!;
  await updateArticleDraft({ articleId, revisionId: draft.revisionId, editVersion: 0, patch: {
    title: `${query}: подтверждённая публикация`, excerpt: `Описание ${query}`, categoryId, tags: [],
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Публичный текст regression fixture подтверждает одинаковую выдачу для всех браузеров." }] }] },
  } }, headers(0));
  await submitArticleForModeration({ articleId, revisionId: draft.revisionId, editVersion: 1 }, headers(0));
  await approveArticleRevision({ revisionId: draft.revisionId }, headers(1));
  slug = (await db.article.findUniqueOrThrow({ where: { id: articleId }, select: { slug: true } })).slug!;

  const first = (await searchPublishedArticles(query, 1)).items.map((article) => article.id);
  const second = (await searchPublishedArticles(query, 1)).items.map((article) => article.id);
  expect(first).toEqual(second);
  expect(first).toContain(articleId);
}, 120_000);

afterAll(async () => {
  try {
    const ids = people.map((person) => person.id);
    if (articleId) {
      await db.article.updateMany({ where: { id: articleId }, data: { status: "DRAFT", publishedRevisionId: null, publishedAt: null } });
      await db.article.deleteMany({ where: { id: articleId } });
    }
    if (ids.length) await db.user.deleteMany({ where: { id: { in: ids } } });
    if (categoryId) await db.category.deleteMany({ where: { id: categoryId } });
    await db.rateLimit.deleteMany({ where: { key: { contains: ip } } });
  } finally {
    server?.kill();
    await db.$disconnect();
  }
}, 90_000);

it("keeps public search identical for guest/auth across desktop and mobile engines", () => runBrowser("search"), 180_000);
it("navigates from the mobile menu in Chromium and WebKit for guest/auth", () => runBrowser("navigation"), 180_000);
it("keeps redesigned public and dashboard pages responsive", () => runBrowser("visual"), 180_000);
