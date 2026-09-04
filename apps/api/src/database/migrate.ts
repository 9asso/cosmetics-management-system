import 'dotenv/config';
import { resolve } from 'node:path';
import { runSqlDirectory } from './migration-runner.js';

await runSqlDirectory(resolve(process.cwd(), '../../database/migrations'), true);
