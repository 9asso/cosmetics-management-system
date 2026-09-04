import 'dotenv/config';
import { Client } from 'ssh2';

const required = ['VPS_HOST', 'VPS_USER', 'VPS_PASSWORD'];
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} is required in .env`);
}

export function connectVps() {
  return new Promise((resolve, reject) => {
    const connection = new Client();
    connection
      .once('ready', () => resolve(connection))
      .once('error', reject)
      .connect({
        host: process.env.VPS_HOST,
        port: Number(process.env.VPS_PORT ?? 22),
        username: process.env.VPS_USER,
        password: process.env.VPS_PASSWORD,
        readyTimeout: 20_000,
        keepaliveInterval: 10_000,
      });
  });
}

export function execRemote(connection, command, { quiet = false } = {}) {
  return new Promise((resolve, reject) => {
    connection.exec(command, (error, stream) => {
      if (error) return reject(error);
      let stdout = '';
      let stderr = '';
      stream.on('data', (chunk) => {
        stdout += chunk;
        if (!quiet) process.stdout.write(chunk);
      });
      stream.stderr.on('data', (chunk) => {
        stderr += chunk;
        if (!quiet) process.stderr.write(chunk);
      });
      stream.once('close', (code) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(`Remote command failed with exit code ${code}: ${stderr.trim()}`));
      });
    });
  });
}

export function upload(connection, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    connection.sftp((error, sftp) => {
      if (error) return reject(error);
      sftp.fastPut(localPath, remotePath, (uploadError) => {
        if (uploadError) reject(uploadError);
        else resolve();
      });
    });
  });
}
