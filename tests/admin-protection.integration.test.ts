import "dotenv/config";
import { randomBytes } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
// Only infrastructure is redirected to an isolated development schema. Services,
// Better Auth and all PostgreSQL constraints/transactions are real.
const state = vi.hoisted(() => ({ db: null as PrismaClient | null }));
vi.mock("@/lib/prisma", () => ({ getPrisma: () => { if (!state.db) throw new Error("Not initialized"); return state.db; } }));
import { getAuth } from "@/lib/auth/server";
import { changeUser } from "@/features/admin/service";
const schema = `narra_phase8_${randomBytes(6).toString("hex")}`;
const root = new Pool({ connectionString: process.env.DATABASE_URL });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` });
const people: { id: string; headers: Headers }[] = [];
beforeAll(async () => {
  await root.query(`CREATE SCHEMA "${schema}"`);
  // Replay all migrations exactly, equivalent to a clean shadow schema replay.
  const connection = await pool.connect();
  try { await connection.query("BEGIN"); for (const folder of readdirSync("prisma/migrations").filter((f) => /^\d/.test(f)).sort()) {
    await connection.query(readFileSync(`prisma/migrations/${folder}/migration.sql`, "utf8"));
  } await connection.query("COMMIT"); } catch (e) { await connection.query("ROLLBACK"); throw e; } finally { connection.release(); }
  state.db = new PrismaClient({ adapter: new PrismaPg(pool, { schema }) });
  for (let i = 0; i < 2; i++) {
    const email = `${schema}_${i}@example.test`;
    const response = await getAuth().handler(new Request(`${process.env.BETTER_AUTH_URL}/api/auth/sign-up/email`, { method: "POST",
      headers: { origin: process.env.BETTER_AUTH_URL!, "content-type": "application/json" }, body: JSON.stringify({ email, name: `Admin ${i}`, username: `admin_${i}`, password: randomBytes(24).toString("hex") }) }));
    expect(response.status).toBe(200);
    const cookie = response.headers.getSetCookie().map((v) => v.split(";")[0]).filter((v) => v.includes("session_token=")).join("; ");
    const user = await state.db.user.update({ where: { email }, data: { role: "ADMIN" } }); people.push({ id: user.id, headers: new Headers({ cookie }) });
  }
}, 120000);
afterAll(async () => {
  await state.db?.$disconnect(); await pool.end();
  // Exact generated schema belongs to this test; no public/user schemas touched.
  if (!/^narra_phase8_[a-f0-9]{12}$/.test(schema)) throw new Error("Invalid cleanup target");
  await root.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await root.end();
}, 60000);
it("serializes mutual demotion and protects the sole remaining active ADMIN", async () => {
  const outcomes = await Promise.allSettled([
    changeUser({ operation: "role", userId: people[1].id, role: "USER" }, people[0].headers),
    changeUser({ operation: "role", userId: people[0].id, role: "USER" }, people[1].headers),
  ]);
  expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const admin = await state.db!.user.findFirstOrThrow({ where: { role: "ADMIN", isBanned: false } });
  expect(await state.db!.user.count({ where: { role: "ADMIN", isBanned: false } })).toBe(1);
  const actor = people.find((p) => p.id === admin.id)!;
  await expect(changeUser({ operation: "role", userId: actor.id, role: "USER" }, actor.headers)).rejects.toThrow("последнего");
  await expect(changeUser({ operation: "ban", userId: actor.id, banned: true }, actor.headers)).rejects.toThrow();
  expect(await state.db!.user.count({ where: { role: "ADMIN", isBanned: false } })).toBe(1);
  const other = people.find((p) => p.id !== actor.id)!;
  await changeUser({ operation: "role", userId: other.id, role: "ADMIN" }, actor.headers);
  const bans = await Promise.allSettled([
    changeUser({ operation: "ban", userId: other.id, banned: true }, actor.headers),
    changeUser({ operation: "ban", userId: actor.id, banned: true }, other.headers),
  ]);
  expect(bans.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(await state.db!.user.count({ where: { role: "ADMIN", isBanned: false } })).toBe(1);
}, 60000);
