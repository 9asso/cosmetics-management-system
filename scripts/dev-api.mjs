import { spawn } from "node:child_process";

// NestJS needs TypeScript's decorator metadata, which tsx/esbuild does not emit.
const build = spawn("pnpm", ["exec", "tsc", "-p", "tsconfig.build.json"], {
  stdio: "inherit",
});
const result = await new Promise((resolve) => build.on("exit", resolve));
if (result !== 0) process.exit(result ?? 1);
const compiler = spawn(
  "pnpm",
  [
    "exec",
    "tsc",
    "-p",
    "tsconfig.build.json",
    "--watch",
    "--preserveWatchOutput",
  ],
  { stdio: ["inherit", "pipe", "pipe"] },
);
let stopping = false;
let restarting = false;
let server;
function launchServer() {
  server = spawn(process.execPath, ["dist/main.js"], { stdio: "inherit" });
  server.once("error", () => stop(1));
  server.once("exit", (code) => {
    if (!stopping && !restarting) stop(code ?? 1);
  });
}
function restartServer() {
  if (!server || restarting || stopping) return;
  restarting = true;
  const previous = server;
  previous.once("exit", () => {
    if (stopping) return;
    restarting = false;
    launchServer();
  });
  previous.kill("SIGTERM");
}
let compilerOutput = "";
let initialWatchBuildFinished = false;
compiler.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  compilerOutput += chunk.toString();
  const lines = compilerOutput.split(/\r?\n/);
  compilerOutput = lines.pop() ?? "";
  for (const line of lines) {
    if (!line.includes("Found 0 errors.")) continue;
    if (initialWatchBuildFinished) restartServer();
    else initialWatchBuildFinished = true;
  }
});
compiler.stderr.pipe(process.stderr);
launchServer();
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  compiler.kill("SIGTERM");
  server?.kill("SIGTERM");
  process.exit(code);
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
compiler.once("error", () => stop(1));
compiler.once("exit", (code) => {
  if (!stopping) stop(code ?? 1);
});
