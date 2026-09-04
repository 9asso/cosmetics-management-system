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
  { stdio: "inherit" },
);
const server = spawn(process.execPath, ["--watch", "dist/main.js"], {
  stdio: "inherit",
});
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  compiler.kill("SIGTERM");
  server.kill("SIGTERM");
  process.exit(code);
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
for (const child of [compiler, server]) {
  child.once("error", () => stop(1));
  child.once("exit", (code) => {
    if (!stopping) stop(code ?? 1);
  });
}
