import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function run(args) {
  execFileSync(pnpm, args, { cwd: root, stdio: "inherit" });
}

run(["--filter", "@cosmetics/contracts", "build"]);
run([
  "--filter",
  "@cosmetics/api",
  "exec",
  "tsc",
  "-p",
  "tsconfig.build.json",
  "--incremental",
  "false",
]);
run([
  "exec",
  "esbuild",
  "apps/api/dist/serverless.js",
  "--bundle",
  "--platform=node",
  "--target=node20",
  "--format=cjs",
  "--outfile=api/serverless.bundle.cjs",
  "--external:sharp",
  "--external:class-transformer",
  "--external:class-validator",
  "--external:@nestjs/websockets/*",
  "--external:@nestjs/microservices*",
  "--external:cache-manager",
]);
