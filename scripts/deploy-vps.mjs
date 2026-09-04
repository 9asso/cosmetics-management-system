import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { connectVps, execRemote, upload } from "./vps-client.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const required = ["VPS_HOST", "VPS_USER", "VPS_PASSWORD"];
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} is required in .env`);
}

const host = process.env.VPS_HOST;
const releaseId = new Date()
  .toISOString()
  .replace(/[^0-9]/g, "")
  .slice(0, 14);
const remoteRoot = "/opt/cosmetics-management";
const remoteRelease = `${remoteRoot}/releases/${releaseId}`;
const remoteArchive = `/tmp/cosmetics-management-${releaseId}.tar.gz`;
const localCredentialPath = join(repoRoot, ".deployment-credentials");
const tempDirectory = mkdtempSync(join(tmpdir(), "cosmetics-deploy-"));
const localArchive = join(tempDirectory, "release.tar.gz");

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'\"'\"'`)}'`;
}

function makeCredentials() {
  const adminUsername = "admin";
  const adminPassword = randomBytes(18).toString("base64url");
  const databasePassword = randomBytes(32).toString("hex");
  const shaPassword = createHash("sha1").update(adminPassword).digest("base64");
  return {
    adminUsername,
    adminPassword,
    databasePassword,
    htpasswd: `${adminUsername}:{SHA}${shaPassword}\n`,
    display: [
      `Storefront: http://${host}/`,
      `Administration: http://${host}/admin/`,
      `Username: ${adminUsername}`,
      `Password: ${adminPassword}`,
      "",
      "These are temporary HTTP Basic Auth credentials. Add a domain and TLS before production use.",
      "",
    ].join("\n"),
  };
}

function createArchive() {
  execFileSync(
    "tar",
    [
      "-czf",
      localArchive,
      "--exclude=.git",
      "--exclude=.env",
      "--exclude=.deployment-credentials",
      "--exclude=node_modules",
      "--exclude=.turbo",
      "--exclude=dist",
      "--exclude=.next",
      "--exclude=target",
      ".",
    ],
    { cwd: repoRoot, stdio: "inherit" },
  );
}

const connection = await connectVps();
try {
  console.log("Preparing deployment archive...");
  createArchive();

  console.log("Preparing the VPS runtime...");
  await execRemote(
    connection,
    `set -eu
export DEBIAN_FRONTEND=noninteractive
if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  apt-get update
  apt-get install -y ca-certificates curl docker.io docker-compose-v2
fi
systemctl enable --now docker
if ! swapon --show=NAME --noheadings | grep -q .; then
  if test ! -f /swapfile; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
  fi
  swapon /swapfile
  grep -qF '/swapfile none swap sw 0 0' /etc/fstab || printf '%s\n' '/swapfile none swap sw 0 0' >> /etc/fstab
fi
mkdir -p ${shellQuote(`${remoteRoot}/releases`)} ${shellQuote(`${remoteRoot}/shared`)} ${shellQuote(remoteRelease)}`,
  );

  const hasSecrets =
    (
      await execRemote(
        connection,
        `if test -s ${shellQuote(`${remoteRoot}/shared/.env`)} && test -s ${shellQuote(`${remoteRoot}/shared/.htpasswd`)} && test -s ${shellQuote(`${remoteRoot}/shared/deployment-credentials`)}; then printf yes; else printf no; fi`,
        { quiet: true },
      )
    ).trim() === "yes";

  if (!hasSecrets) {
    console.log(
      "Generating persistent database and administration credentials...",
    );
    const credentials = makeCredentials();
    const environment = `POSTGRES_PASSWORD=${credentials.databasePassword}\nPUBLIC_ORIGIN=http://${host}\n`;
    const localEnvironment = join(tempDirectory, "production.env");
    const localHtpasswd = join(tempDirectory, ".htpasswd");
    const localRemoteCredentials = join(
      tempDirectory,
      "deployment-credentials",
    );
    writeFileSync(localEnvironment, environment, { mode: 0o600 });
    writeFileSync(localHtpasswd, credentials.htpasswd, { mode: 0o600 });
    writeFileSync(localRemoteCredentials, credentials.display, { mode: 0o600 });
    await upload(
      connection,
      localEnvironment,
      `${remoteRoot}/shared/.env.upload`,
    );
    await upload(
      connection,
      localHtpasswd,
      `${remoteRoot}/shared/.htpasswd.upload`,
    );
    await upload(
      connection,
      localRemoteCredentials,
      `${remoteRoot}/shared/deployment-credentials.upload`,
    );
    await execRemote(
      connection,
      `install -m 600 ${shellQuote(`${remoteRoot}/shared/.env.upload`)} ${shellQuote(`${remoteRoot}/shared/.env`)}
install -m 600 ${shellQuote(`${remoteRoot}/shared/.htpasswd.upload`)} ${shellQuote(`${remoteRoot}/shared/.htpasswd`)}
install -m 600 ${shellQuote(`${remoteRoot}/shared/deployment-credentials.upload`)} ${shellQuote(`${remoteRoot}/shared/deployment-credentials`)}
rm -f ${shellQuote(`${remoteRoot}/shared/.env.upload`)} ${shellQuote(`${remoteRoot}/shared/.htpasswd.upload`)} ${shellQuote(`${remoteRoot}/shared/deployment-credentials.upload`)}`,
      { quiet: true },
    );
    writeFileSync(localCredentialPath, credentials.display, { mode: 0o600 });
  } else {
    const savedCredentials = await execRemote(
      connection,
      `cat ${shellQuote(`${remoteRoot}/shared/deployment-credentials`)}`,
      { quiet: true },
    );
    writeFileSync(localCredentialPath, savedCredentials, { mode: 0o600 });
  }

  console.log("Uploading the application...");
  await upload(connection, localArchive, remoteArchive);
  await execRemote(
    connection,
    `set -eu
tar -xzf ${shellQuote(remoteArchive)} -C ${shellQuote(remoteRelease)}
rm -f ${shellQuote(remoteArchive)}
cd ${shellQuote(remoteRelease)}
COMPOSE_PARALLEL_LIMIT=1 docker compose --env-file ${shellQuote(`${remoteRoot}/shared/.env`)} -p cosmetics-management -f compose.production.yml up -d --build
docker compose --env-file ${shellQuote(`${remoteRoot}/shared/.env`)} -p cosmetics-management -f compose.production.yml exec -T api node dist/database/seed.js
ln -sfn ${shellQuote(remoteRelease)} ${shellQuote(`${remoteRoot}/current`)}
curl --retry 10 --retry-delay 3 --retry-connrefused -fsS http://127.0.0.1/api/v1/health
curl --retry 10 --retry-delay 3 --retry-connrefused -fsS http://127.0.0.1/ >/dev/null
test "$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1/admin/)" = 401
docker compose --env-file ${shellQuote(`${remoteRoot}/shared/.env`)} -p cosmetics-management -f compose.production.yml ps`,
  );

  console.log(
    `Deployment complete. Credentials were saved to ${localCredentialPath}`,
  );
} finally {
  connection.end();
  rmSync(tempDirectory, { recursive: true, force: true });
}
