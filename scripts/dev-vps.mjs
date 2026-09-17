/**
 * dev-vps.mjs
 *
 * Starts the NestJS API locally connected to the VPS PostgreSQL database.
 * - Opens an SSH tunnel: localhost:5433 → VPS → Docker postgres (172.18.0.3:5432)
 * - Runs pending migrations against the VPS database
 * - Starts the API dev server (hot-reload via tsc --watch)
 *
 * Usage:
 *   node scripts/dev-vps.mjs
 *   node scripts/dev-vps.mjs --skip-migrate
 */

import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import { parse } from "dotenv";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skipMigrate = process.argv.includes("--skip-migrate");

const dotenv = existsSync(resolve(root, ".env"))
  ? parse(readFileSync(resolve(root, ".env")))
  : {};

const VPS_HOST     = dotenv.VPS_HOST     || "162.35.107.230";
const VPS_USER     = dotenv.VPS_USER     || "root";
const VPS_PASSWORD = dotenv.VPS_PASSWORD || "";

const DB_USER           = "cosmetics";
const DB_PASS           = "37587b3e4a2a34eabc284a401c2c6d1df587274c1b4cdc8b244bd069102b5e81";
const DB_NAME           = "cosmetics";
const TUNNEL_LOCAL_PORT = 5433;
const CONTAINER_IP      = "172.18.0.3";
const CONTAINER_PORT    = 5432;

const DATABASE_URL = `postgresql://${DB_USER}:${encodeURIComponent(DB_PASS)}@127.0.0.1:${TUNNEL_LOCAL_PORT}/${DB_NAME}`;

const nvmBin = resolve(process.env.HOME || "", ".nvm/versions/node", process.version, "bin");
const extraPaths = ["/opt/homebrew/bin", "/usr/local/bin", nvmBin, resolve(root, "node_modules/.bin")].filter(existsSync);
const PATH = extraPaths.length ? `${extraPaths.join(":")}:${process.env.PATH || ""}` : process.env.PATH;

const env = {
  ...process.env,
  PATH,
  NODE_ENV: "development",
  DATABASE_URL,
  API_PORT: "4000",
  API_HOST: "127.0.0.1",
  API_URL: "http://localhost:4000/api/v1",
  VITE_API_URL: "http://localhost:4000/api/v1",
  NEXT_PUBLIC_API_URL: "http://localhost:4000/api/v1",
  CORS_ORIGINS: "http://localhost:1420,http://127.0.0.1:1420,http://localhost:3000,http://127.0.0.1:3000",
  AUTH_SECRET: "48abca4837a1cf338f6d54e3e9b45c4344be7cbafb57e59515644f49e817ba93691da79c9007e115cba924d7ae895f04",
  ADMIN_EMAIL: "owner@glowcare.ma",
  ADMIN_PASSWORD: "gCbZGbdXndK2OgyINQuanThu",
};

const children = [];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const c of children) if (c.exitCode === null) c.kill("SIGTERM");
  setTimeout(() => process.exit(code), 1500);
}
process.on("SIGINT",  () => stop());
process.on("SIGTERM", () => stop());

function run(args, { wait = true } = {}) {
  const child = spawn("pnpm", args, { cwd: root, env, stdio: ["ignore", "inherit", "inherit"] });
  children.push(child);
  if (!wait) return child;
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`pnpm ${args.join(" ")} exited with ${code}`))
    );
  });
}

function waitForPort(port, host = "127.0.0.1", timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    function attempt() {
      const sock = createConnection({ host, port });
      sock.once("connect", () => { sock.destroy(); resolve(); });
      sock.once("error", () => {
        sock.destroy();
        if (Date.now() >= deadline) return reject(new Error(`Port ${port} not reachable after ${timeoutMs}ms`));
        setTimeout(attempt, 400);
      });
    }
    attempt();
  });
}

try {
  // 1. Check if tunnel already up
  let tunnelAlreadyUp = false;
  try { await waitForPort(TUNNEL_LOCAL_PORT, "127.0.0.1", 800); tunnelAlreadyUp = true; } catch {}

  if (tunnelAlreadyUp) {
    console.log(`✓ SSH tunnel already running on port ${TUNNEL_LOCAL_PORT}`);
  } else {
    console.log(`Opening SSH tunnel localhost:${TUNNEL_LOCAL_PORT} → ${VPS_HOST} → ${CONTAINER_IP}:${CONTAINER_PORT} ...`);
    const sshArgs = [
      "-o", "StrictHostKeyChecking=no",
      "-o", "ServerAliveInterval=30",
      "-N",
      "-L", `${TUNNEL_LOCAL_PORT}:${CONTAINER_IP}:${CONTAINER_PORT}`,
      `${VPS_USER}@${VPS_HOST}`,
    ];
    const tunnel = VPS_PASSWORD
      ? spawn("sshpass", [`-p${VPS_PASSWORD}`, "ssh", ...sshArgs], { stdio: "ignore" })
      : spawn("ssh", sshArgs, { stdio: "ignore" });
    children.push(tunnel);
    tunnel.once("error", (e) => { console.error("SSH tunnel error:", e.message); stop(1); });
    tunnel.once("exit",  (c) => { if (!stopping) { console.error(`SSH tunnel exited (${c})`); stop(1); } });
    await waitForPort(TUNNEL_LOCAL_PORT, "127.0.0.1", 10_000);
    console.log(`✓ SSH tunnel ready on port ${TUNNEL_LOCAL_PORT}`);
  }

  // 2. Build contracts
  console.log("Building contracts...");
  await run(["--filter", "@cosmetics/contracts", "build"]);

  // 3. Migrate
  if (!skipMigrate) {
    console.log("Running migrations against VPS database...");
    await run(["--filter", "@cosmetics/api", "db:migrate"]);
    console.log("✓ Migrations complete");
  }

  // 4. Start API
  console.log("\n✓ Starting API at http://localhost:4000/api/v1  (VPS database)\n");
  const api = run(["--filter", "@cosmetics/api", "dev"], { wait: false });
  api.once("exit", (code) => { if (!stopping) stop(code ?? 1); });

} catch (err) {
  console.error("VPS dev startup failed:", err?.message || err);
  stop(1);
}
