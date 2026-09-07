import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'dotenv';

// Never use the deployment environment for integration tests.
const root = fileURLToPath(new URL('../', import.meta.url));
const local = parse(readFileSync(resolve(root, '.env.local')));
if (!local.ADMIN_PASSWORD) throw new Error('ADMIN_PASSWORD is required in .env.local.');
const env = { ...process.env, LOCAL_TEST_DATABASE_URL: `postgresql://onight:${encodeURIComponent(local.ADMIN_PASSWORD)}@127.0.0.1:54329/onight` };
for (const args of [['--filter', '@cosmetics/contracts', 'build'], ['--filter', '@cosmetics/api', 'test']]) {
  const result = spawnSync('pnpm', args, { cwd: root, env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
