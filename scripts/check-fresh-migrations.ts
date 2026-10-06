import "dotenv/config";
import { randomBytes, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";

// Only an explicitly confirmed development target. Never reset an existing schema.
if (!process.argv.includes("--confirm-development") || process.env.VERCEL_ENV === "production") {
  throw new Error("Use --confirm-development with a development database only.");
}
const schema = `narra_phase10_${randomBytes(8).toString("hex")}`;
let pool: Pool | undefined;
let created = false;
try {
  const target = new URL(process.env.DIRECT_URL || process.env.DATABASE_URL || "");
  if (!["postgresql:", "postgres:"].includes(target.protocol)) throw new Error("Invalid database protocol");
  const migrations = readdirSync("prisma/migrations", { withFileTypes: true }).filter((item) => item.isDirectory()).map((item) => item.name).sort();
  const checksums = new Map(migrations.map((name) => {
    const sql = readFileSync(`prisma/migrations/${name}/migration.sql`);
    // Review before replay, including any future migrations added to this command.
    if (/\b(DROP\s+(TABLE|COLUMN|SCHEMA|DATABASE|TYPE)|TRUNCATE\s|DELETE\s+FROM)\b/i.test(sql.toString())) throw new Error("Destructive migration requires review");
    return [name, createHash("sha256").update(sql).digest("hex")];
  }));
  pool = new Pool({ connectionString: target.toString(), connectionTimeoutMillis: 30000, max: 1 });
  await pool.query(`CREATE SCHEMA "${schema}"`);
  created = true;
  target.searchParams.set("schema", schema);
  target.searchParams.set("connect_timeout", "30");
  const env = { ...process.env, DATABASE_URL: target.toString(), DIRECT_URL: target.toString() };
  const cli = resolve("node_modules/prisma/build/index.js");
  // Capture CLI output: it contains endpoint identifiers and is not a public log.
  execFileSync(process.execPath, [cli, "migrate", "deploy"], { env, timeout: 180000, stdio: "pipe", windowsHide: true });
  const status = execFileSync(process.execPath, [cli, "migrate", "status"], { env, timeout: 90000, encoding: "utf8", stdio: "pipe", windowsHide: true });
  if (!status.includes("Database schema is up to date")) throw new Error("Unexpected migration status");
  const rows = (await pool.query(`SELECT migration_name, checksum, finished_at, rolled_back_at FROM "${schema}"."_prisma_migrations"`)).rows;
  if (rows.length !== migrations.length || rows.some((row) => !row.finished_at || row.rolled_back_at || checksums.get(row.migration_name) !== row.checksum)) throw new Error("Migration checksum/status mismatch");
  console.log(`Fresh development schema: ${rows.length} migrations deployed, checksums match, status up to date.`);
} catch {
  console.error("Fresh migration check FAILED. Check development connectivity, permissions and migration SQL; no credentials or CLI output logged.");
  process.exitCode = 1;
} finally {
  if (pool) {
    try {
      if (created && /^narra_phase10_[a-f0-9]{16}$/.test(schema)) {
        await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
        console.log("Temporary schema removed; existing schemas preserved.");
      }
    } catch { console.error(`Cleanup FAILED for this check's schema: ${schema}`); process.exitCode = 1; }
    finally { await pool.end(); }
  }
}
