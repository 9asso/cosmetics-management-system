import 'dotenv/config';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { DEFAULT_ORGANIZATION_ID } from '../constants.js';
import { runSqlDirectory } from './migration-runner.js';

await runSqlDirectory(resolve(process.cwd(), '../../database/seeds'), false, 'dev.sql');
await runSqlDirectory(resolve(process.cwd(), '../../database/seeds'), false, 'catalog-demo.sql');
await runSqlDirectory(resolve(process.cwd(), '../../database/seeds'), false, 'dashboard-demo.sql');

const adminEmail = process.env.ADMIN_EMAIL ?? 'owner@onight.local';
const adminPassword = process.env.ADMIN_PASSWORD ?? 'ChangeMe123!';
if (process.env.NODE_ENV === 'production' && (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD)) {
  throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required in production');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query(
    `INSERT INTO users
      (organization_id, email, display_name, password_hash, role)
     VALUES ($1, lower($2), 'Admin ONight', crypt($3, gen_salt('bf', 12)), 'OWNER')
     ON CONFLICT (organization_id, email) DO UPDATE
     SET password_hash = EXCLUDED.password_hash,
         display_name = CASE WHEN users.display_name ILIKE '%GlowCare%' THEN 'Admin ONight' ELSE users.display_name END,
         active = true,
         updated_at = now()`,
    [DEFAULT_ORGANIZATION_ID, adminEmail, adminPassword],
  );
} finally {
  await pool.end();
}
