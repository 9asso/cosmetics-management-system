import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';

export async function runSqlDirectory(
  directory: string,
  trackMigrations: boolean,
  onlyFilename?: string,
) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');

  const pool = new Pool({ connectionString });
  try {
    if (trackMigrations) {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          filename text PRIMARY KEY,
          checksum text NOT NULL,
          applied_at timestamptz NOT NULL DEFAULT now()
        )
      `);
    }

    const files = (await readdir(directory))
      .filter((name) => name.endsWith('.sql') && (!onlyFilename || name === onlyFilename))
      .sort();
    for (const filename of files) {
      const sql = await readFile(resolve(directory, filename), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      if (trackMigrations) {
        const existing = await pool.query<{ checksum: string }>(
          'SELECT checksum FROM schema_migrations WHERE filename = $1',
          [filename],
        );
        if (existing.rowCount) {
          if (existing.rows[0]?.checksum !== checksum) {
            throw new Error(`Migration ${filename} changed after it was applied`);
          }
          continue;
        }
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        if (trackMigrations) {
          await client.query(
            'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)',
            [filename, checksum],
          );
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      process.stdout.write(`Applied ${filename}\n`);
    }
  } finally {
    await pool.end();
  }
}
