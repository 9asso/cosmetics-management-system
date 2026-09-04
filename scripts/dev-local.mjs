import EmbeddedPostgres from "embedded-postgres";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { parse } from "dotenv";

// An isolated, persistent local demo. Never read deployment credentials from .env.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const localFile = resolve(root, ".env.local");
if (!existsSync(localFile))
  throw new Error(
    "Create .env.local with ADMIN_EMAIL, ADMIN_PASSWORD and AUTH_SECRET. See docs/local-development.md.",
  );
const local = parse(readFileSync(localFile));
for (const key of ["ADMIN_EMAIL", "ADMIN_PASSWORD", "AUTH_SECRET"]) {
  if (!local[key]) throw new Error(`${key} is required in .env.local`);
}
const databaseDir = resolve(root, ".local/postgres");
const database = new EmbeddedPostgres({
  databaseDir,
  user: "onight",
  password: local.ADMIN_PASSWORD,
  port: 54329,
  persistent: true,
  postgresFlags: ["-h", "127.0.0.1", "-c", "lc_messages=C"],
  onLog: () => {},
  onError: (message) => console.error(message),
});
const env = {
  ...process.env,
  ...local,
  NODE_ENV: "development",
  DATABASE_URL: `postgresql://onight:${encodeURIComponent(local.ADMIN_PASSWORD)}@127.0.0.1:54329/onight`,
  API_PORT: "4000",
  API_HOST: "127.0.0.1",
  API_URL: "http://localhost:4000/api/v1",
  NEXT_PUBLIC_API_URL: "http://localhost:4000/api/v1",
  VITE_API_URL: "http://localhost:4000/api/v1",
  VITE_BASE_PATH: "/",
  CORS_ORIGINS:
    "http://localhost:1420,http://127.0.0.1:1420,http://localhost:3000,http://127.0.0.1:3000",
};
const children = [];
function run(args, wait = true) {
  const child = spawn("pnpm", args, { cwd: root, env, stdio: "inherit" });
  children.push(child);
  if (!wait) return child;
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`pnpm ${args.join(" ")} exited with ${code}`)),
    );
  });
}
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children)
    if (child.exitCode === null) child.kill("SIGTERM");
  await database.stop();
  process.exit(code);
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
try {
  if (!existsSync(resolve(databaseDir, "PG_VERSION")))
    await database.initialise();
  await database.start();
  const client = database.getPgClient("postgres", "127.0.0.1");
  await client.connect();
  const found = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = 'onight'",
  );
  await client.end();
  const firstRun = found.rowCount === 0;
  if (firstRun) await database.createDatabase("onight");
  await run(["--filter", "@cosmetics/contracts", "build"]);
  await run(["--filter", "@cosmetics/api", "db:migrate"]);
  const demoClient = database.getPgClient("onight", "127.0.0.1");
  await demoClient.connect();
  const users = await demoClient.query("SELECT 1 FROM users LIMIT 1");
  await demoClient.end();
  if (users.rowCount === 0 || process.argv.includes("--seed"))
    await run(["--filter", "@cosmetics/api", "db:seed"]);
  console.log(
    "ONight local database ready at 127.0.0.1:54329. Data stays in .local/postgres.",
  );
  if (!process.argv.includes("--database-only")) {
    const api = run(["--filter", "@cosmetics/api", "dev"], false);
    const store = run(
      ["--filter", "@cosmetics/storefront", "dev", "--hostname", "127.0.0.1"],
      false,
    );
    const dashboard = process.argv.includes("--reuse-dashboard")
      ? null
      : run(
          ["--filter", "@cosmetics/desktop", "dev", "--host", "127.0.0.1"],
          false,
        );
    for (const child of [api, store, dashboard].filter(Boolean))
      child.once("exit", (code) => {
        if (!stopping) void stop(code ?? 1);
      });
    console.log(
      "Dashboard: http://localhost:1420 · Store: http://localhost:3000",
    );
  }
  // Retain the database supervisor even in --database-only mode.
  setInterval(() => {}, 60_000);
} catch (error) {
  console.error(
    error?.message ??
      "Local startup failed. Check that the local ports are available.",
  );
  await stop(1);
}
