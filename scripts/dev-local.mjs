import EmbeddedPostgres from "embedded-postgres";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, execSync } from "node:child_process";
import { createConnection } from "node:net";
import { parse } from "dotenv";

// An isolated, persistent local demo. Never read deployment credentials from .env.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const databaseOnly = process.argv.includes("--database-only");
const apiOnly = process.argv.includes("--api-only");
if (databaseOnly && apiOnly)
  throw new Error("Use either --database-only or --api-only, not both.");
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
let lastDbError = "";
const database = new EmbeddedPostgres({
  databaseDir,
  user: "onight",
  password: local.ADMIN_PASSWORD,
  port: 54329,
  persistent: true,
  postgresFlags: ["-h", "127.0.0.1", "-F", "-c", "lc_messages=C"],
  onLog: () => {},
  onError: (message) => {
    lastDbError = message;
    console.error(message);
  },
});

const nvmBin = resolve(
  process.env.HOME || "",
  ".nvm/versions/node",
  process.version,
  "bin",
);
const extraPaths = [
  "/opt/homebrew/bin",
  "/usr/local/bin",
  nvmBin,
  resolve(root, "node_modules/.bin"),
].filter(existsSync);

const env = {
  ...process.env,
  ...local,
  PATH: extraPaths.length
    ? `${extraPaths.join(":")}:${process.env.PATH || ""}`
    : process.env.PATH,
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
let ownsDatabase = false;
function run(args, wait = true) {
  const child = spawn("pnpm", args, {
    cwd: root,
    env,
    stdio: ["ignore", "inherit", "inherit"],
  });
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
  if (ownsDatabase) await database.stop();
  process.exit(code);
}
async function canConnectToLocalDatabase() {
  const client = database.getPgClient("postgres", "127.0.0.1");
  try {
    await client.connect();
    await client.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}
function isLocalDatabasePortInUse() {
  return new Promise((resolvePortCheck) => {
    const socket = createConnection({ host: "127.0.0.1", port: 54329 });
    socket.setTimeout(1_000);
    socket.once("connect", () => {
      socket.destroy();
      resolvePortCheck(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolvePortCheck(false);
    });
    socket.once("error", () => resolvePortCheck(false));
  });
}
function cleanStaleDatabase() {
  // 1. Kill any stale postgres processes referencing our local database directory
  try {
    const psOut = execSync("ps -ax -o pid,command", { encoding: "utf-8" });
    for (const line of psOut.split("\n")) {
      if (
        (line.includes("postgres") && line.includes(".local/postgres")) ||
        line.includes("postgres: startup") ||
        line.includes("postgres: checkpointer") ||
        line.includes("postgres: background writer")
      ) {
        const pid = parseInt(line.trim().split(/\s+/)[0] || "", 10);
        if (pid && !isNaN(pid) && pid !== process.pid) {
          try {
            process.kill(pid, "SIGKILL");
          } catch {}
        }
      }
    }
  } catch {}

  // 2. Remove stale postmaster pid files
  const pidFiles = [
    resolve(databaseDir, "postmaster.pid"),
    resolve(databaseDir, "postmaster 2.pid"),
  ];
  for (const pidFile of pidFiles) {
    if (!existsSync(pidFile)) continue;
    try {
      unlinkSync(pidFile);
    } catch {}
  }

  // 3. Clear any dangling SysV shared memory segments on macOS/Linux
  if (process.platform === "darwin" || process.platform === "linux") {
    try {
      const ipcsOut = execSync("ipcs -m", { encoding: "utf-8" });
      for (const line of ipcsOut.split("\n")) {
        const match = line.match(/^m\s+(\d+)\s+/);
        if (match && match[1]) {
          try {
            execSync(`ipcrm -m ${match[1]}`, { stdio: "ignore" });
          } catch {}
        }
      }
    } catch {}
  }
}

process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
try {
  const reuseDatabase = await canConnectToLocalDatabase();
  if (!reuseDatabase) {
    if (await isLocalDatabasePortInUse())
      throw new Error(
        "Port 54329 is already used by a different database or the local ADMIN_PASSWORD changed. Stop that process or restore the password used to create .local/postgres.",
      );
    cleanStaleDatabase();
    if (!existsSync(resolve(databaseDir, "PG_VERSION")))
      await database.initialise();
    await database.start();
    ownsDatabase = true;
  }
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
    `ONight local database ${reuseDatabase ? "reused" : "ready"} at 127.0.0.1:54329. Data stays in .local/postgres.`,
  );
  if (!databaseOnly) {
    const api = run(["--filter", "@cosmetics/api", "dev"], false);
    const store = apiOnly
      ? null
      : run(
          [
            "--filter",
            "@cosmetics/storefront",
            "dev",
            "--hostname",
            "127.0.0.1",
          ],
          false,
        );
    const dashboard =
      apiOnly || process.argv.includes("--reuse-dashboard")
        ? null
        : run(
            ["--filter", "@cosmetics/desktop", "dev", "--host", "127.0.0.1"],
            false,
          );
    // Storefront failure is non-fatal — API and desktop keep running.
    store?.once("exit", (code) => {
      if (!stopping && code !== 0)
        console.warn(`[storefront] exited with code ${code ?? 1} — continuing without it.`);
    });
    for (const child of [api, dashboard].filter(Boolean))
      child.once("exit", (code) => {
        if (!stopping) void stop(code ?? 1);
      });
    console.log(
      apiOnly
        ? "API starting at http://localhost:4000/api/v1"
        : "Dashboard: http://localhost:1420 · Store: http://localhost:3000",
    );
  }
  // Retain the database supervisor even in --database-only mode.
  setInterval(() => {}, 60_000);
} catch (error) {
  console.error(
    error?.message ||
      lastDbError ||
      "Local startup failed. Check that the local ports are available.",
  );
  await stop(1);
}
