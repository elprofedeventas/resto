/* RESTO — utilidad para inyectar las credenciales server-side a web/.env.local.

   Lee `scripts/service-account.json` y agrega las variables de entorno que
   las Vercel Functions necesitan para hablar con Firestore (Admin SDK).

   Uso:
     node scripts/setup-env.js

   Es idempotente: si las variables ya están en web/.env.local, no las
   duplica. */

import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESTAURANT_ID = 'resto-demo';

const saPath = join(__dirname, 'service-account.json');
const envPath = join(__dirname, '..', 'web', '.env.local');

if (!existsSync(saPath)) {
  console.error(`No se encontró ${saPath}.`);
  process.exit(1);
}

if (!existsSync(envPath)) {
  console.error(`No se encontró ${envPath}.`);
  process.exit(1);
}

const sa = JSON.parse(readFileSync(saPath, 'utf8'));
const env = readFileSync(envPath, 'utf8');

if (env.includes('FIREBASE_SERVICE_ACCOUNT_JSON=')) {
  console.log('FIREBASE_SERVICE_ACCOUNT_JSON ya está presente; no se modifica.');
  process.exit(0);
}

const lines = [
  '',
  '# Server-side — Vercel Functions (no se exponen al cliente)',
  `FIREBASE_SERVICE_ACCOUNT_JSON='${JSON.stringify(sa)}'`,
  `RESTAURANT_ID=${RESTAURANT_ID}`,
  ''
].join('\n');

appendFileSync(envPath, lines);
console.log('OK — credenciales server-side agregadas a web/.env.local');
