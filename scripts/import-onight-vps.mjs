import "dotenv/config";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { connectVps, execRemote, upload } from "./vps-client.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(process.argv[2] ?? "");
if (!process.argv[2] || !existsSync(source)) {
  throw new Error(
    "Usage: node scripts/import-onight-vps.mjs /absolute/path/onight.db",
  );
}

const stamp = new Date()
  .toISOString()
  .replace(/[^0-9]/g, "")
  .slice(0, 14);
const remoteDatabase = `/tmp/onight-client-${stamp}.db`;
const remoteImporter = `/tmp/import-onight-${stamp}.mjs`;
const importer = resolve(root, "scripts/import-onight-sqlite.mjs");
const connection = await connectVps();

try {
  await upload(connection, source, remoteDatabase);
  await upload(connection, importer, remoteImporter);
  await execRemote(
    connection,
    `set -eu
root=/opt/cosmetics-management
release=$(readlink -f "$root/current")
environment="$root/shared/.env"
backup="$root/shared/backups/before-client-import-${stamp}.dump"
mkdir -p "$root/shared/backups"
cd "$release"
docker compose --env-file "$environment" -p cosmetics-management -f compose.production.yml exec -T postgres pg_dump -Fc -U cosmetics cosmetics > "$backup"
test -s "$backup"
docker compose --env-file "$environment" -p cosmetics-management -f compose.production.yml cp ${remoteImporter} api:/app/apps/api/import-onight-sqlite.mjs
docker compose --env-file "$environment" -p cosmetics-management -f compose.production.yml cp ${remoteDatabase} api:/tmp/onight-client.db
docker compose --env-file "$environment" -p cosmetics-management -f compose.production.yml exec -T api node import-onight-sqlite.mjs /tmp/onight-client.db
curl -fsS http://127.0.0.1/api/v1/health
set -a
. "$environment"
set +a
curl -fsS -H 'Content-Type: application/json' --data "$(printf '{\"email\":\"%s\",\"password\":\"%s\"}' "$ADMIN_EMAIL" "$ADMIN_PASSWORD")" http://127.0.0.1/api/v1/auth/login >/dev/null
printf '\nBACKUP=%s\n' "$backup"
rm -f ${remoteDatabase} ${remoteImporter}`,
  );
} finally {
  connection.end();
}
