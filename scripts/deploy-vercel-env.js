/* RESTO — sube las variables de entorno de web/.env.local a Vercel
   (environment: production). Genera CRON_SECRET aleatorio si no existe.

   Uso:
     node scripts/deploy-vercel-env.js

   Requiere `vercel` CLI logueado y el proyecto linkeado en web/.vercel/. */

import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import crypto from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webDir = join(__dirname, '..', 'web');
const envPath = join(webDir, '.env.local');

if (!existsSync(envPath)) {
  console.error(`No se encontró ${envPath}.`);
  process.exit(1);
}

let env = readFileSync(envPath, 'utf8');

if (!/^CRON_SECRET=/m.test(env)) {
  const secret = crypto.randomBytes(32).toString('hex');
  const block = [
    '',
    '# Vercel Cron (autoriza el endpoint /api/cron/archive-old-orders)',
    `CRON_SECRET=${secret}`,
    ''
  ].join('\n');
  appendFileSync(envPath, block);
  env = readFileSync(envPath, 'utf8');
  console.log('CRON_SECRET generado y agregado a web/.env.local');
}

const vars = [];
for (const rawLine of env.split('\n')) {
  const line = rawLine.trim();
  if (!line || line.startsWith('#')) continue;
  const eq = line.indexOf('=');
  if (eq < 1) continue;
  const key = line.slice(0, eq).trim();
  let value = line.slice(eq + 1).trim();
  if (
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'))
  ) {
    value = value.slice(1, -1);
  }
  vars.push({ key, value });
}

console.log(
  `\nSubiendo ${vars.length} variables a Vercel (environment: production)...\n`
);

let added = 0;
let skipped = 0;
let failed = 0;

for (const { key, value } of vars) {
  // Remove existing (ignore failure if doesn't exist).
  try {
    execSync(`vercel env rm ${key} production --yes`, {
      cwd: webDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch {
    // doesn't exist, OK
  }

  // Add with value (sin trailing newline).
  try {
    execSync(`vercel env add ${key} production`, {
      cwd: webDir,
      input: value,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    console.log(`  ✓ ${key}`);
    added += 1;
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : '';
    const stdout = err.stdout ? err.stdout.toString() : '';
    const msg = stderr + stdout;
    console.error(`  ✗ ${key}: ${(msg.split('\n')[0] || err.message).slice(0, 200)}`);
    failed += 1;
  }
}

console.log(
  `\nResultado: ${added} agregadas, ${skipped} omitidas, ${failed} fallidas.`
);
console.log('\nProximo paso: cd web && vercel --prod\n');
