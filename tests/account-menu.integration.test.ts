import "dotenv/config";
import { randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getAuth } from "@/lib/auth/server";
import { getPrisma } from "@/lib/prisma";

const db = getPrisma();
const run = randomBytes(6).toString("hex");
const email = `narra-account-menu-${run}@example.test`;
const username = `account_menu_${run}`;
const password = randomBytes(24).toString("base64url");
const base = "http://127.0.0.1:3107";
let server: ChildProcess | undefined;
let cookie = "";

async function waitForServer() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(base);
      if (response.ok) return;
    } catch { /* Server is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Narra production server did not start for account-menu regression.");
}

beforeAll(async () => {
  process.env.BETTER_AUTH_URL = base;
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3107"], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: "production", BETTER_AUTH_URL: base, SITE_URL: "", VERCEL: "", VERCEL_ENV: "" },
    stdio: "ignore",
  });
  await waitForServer();
  const response = await getAuth().handler(new Request(`${base}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { origin: base, "content-type": "application/json", "x-forwarded-for": "198.18.10.7" },
    body: JSON.stringify({ name: "Павел", username, email, password }),
  }));
  expect(response.status).toBe(200);
  cookie = response.headers.getSetCookie().map((value) => value.split(";")[0]).find((value) => value.includes("session_token=")) ?? "";
  expect(cookie).not.toBe("");
}, 90_000);

afterAll(async () => {
  try {
    const user = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (user) await db.user.delete({ where: { id: user.id } });
    await db.rateLimit.deleteMany({ where: { key: { contains: "198.18.10.7" } } });
  } finally {
    server?.kill();
    await db.$disconnect();
  }
}, 60_000);

it("keeps the controlled account menu alive at every content edge", () => {
  const result = spawn(process.execPath, ["tests/account-menu.browser.mjs", JSON.stringify({ base, cookie })], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  return new Promise<void>((resolve, reject) => {
    let output = "", error = "";
    result.stdout?.on("data", (chunk) => { output += String(chunk); });
    result.stderr?.on("data", (chunk) => { error += String(chunk); });
    result.on("exit", (code) => code === 0 ? (console.log(output.trim()), resolve()) : reject(new Error(error || output)));
  });
}, 120_000);
