import { connectVps, execRemote } from './vps-client.mjs';

const connection = await connectVps();
try {
  await execRemote(
    connection,
    `printf 'CONNECTED\\n'
uname -srm
if test -r /etc/os-release; then . /etc/os-release; printf 'OS=%s %s\\n' "$ID" "$VERSION_ID"; fi
printf 'DOCKER='; command -v docker || true
printf 'COMPOSE='; docker compose version 2>/dev/null || true
printf 'NGINX='; command -v nginx || true
printf 'CADDY='; command -v caddy || true
printf 'GIT='; command -v git || true
df -h / | tail -1
free -h 2>/dev/null | sed -n '1,2p'
ss -lntp 2>/dev/null | sed -n '1,20p'`,
  );
} finally {
  connection.end();
}
