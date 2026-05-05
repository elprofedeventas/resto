/* RESTO — migración one-shot: mueve los handlers de /web/api/<dominio>/...
   a /web/api/_handlers/<nombre-plano>.js y normaliza imports relativos a
   `../_lib/...`. Después borra las carpetas viejas si quedan vacías.

   Esta migración consolida el backend a 1 sola Vercel Function (vía
   /web/api/[[...slug]].js que despacha) para entrar en el límite del
   plan Hobby. */

import {
  readFileSync,
  writeFileSync,
  unlinkSync,
  mkdirSync,
  rmdirSync,
  existsSync,
  readdirSync
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(__dirname, '..', 'web', 'api');
const handlersDir = join(apiRoot, '_handlers');

const moves = [
  { from: 'auth/login.js', to: 'auth-login.js' },
  { from: 'auth/logout.js', to: 'auth-logout.js' },
  { from: 'restaurant/index.js', to: 'restaurant.js' },
  { from: 'locales/index.js', to: 'locales-list.js' },
  { from: 'locales/[id].js', to: 'locales-detail.js' },
  { from: 'users/index.js', to: 'users-list.js' },
  { from: 'users/[id].js', to: 'users-detail.js' },
  { from: 'ingredients/index.js', to: 'ingredients-list.js' },
  { from: 'ingredients/[id].js', to: 'ingredients-detail.js' },
  { from: 'dishes/index.js', to: 'dishes-list.js' },
  { from: 'dishes/[id]/index.js', to: 'dishes-detail.js' },
  { from: 'dishes/[id]/recipe.js', to: 'dishes-recipe.js' },
  { from: 'dishes/[id]/overrides.js', to: 'dishes-overrides.js' },
  { from: 'tables/index.js', to: 'tables-list.js' },
  { from: 'tables/[id].js', to: 'tables-detail.js' },
  { from: 'orders/index.js', to: 'orders-list.js' },
  { from: 'orders/[id]/index.js', to: 'orders-detail.js' },
  { from: 'orders/[id]/items.js', to: 'orders-items.js' },
  { from: 'orders/[id]/items/[itemId]/index.js', to: 'orders-item-detail.js' },
  { from: 'orders/[id]/items/[itemId]/ready.js', to: 'orders-item-ready.js' },
  { from: 'orders/[id]/send-to-kitchen.js', to: 'orders-send-to-kitchen.js' },
  { from: 'orders/[id]/cancel.js', to: 'orders-cancel.js' },
  { from: 'orders/[id]/move-item.js', to: 'orders-move-item.js' },
  { from: 'orders/[id]/close.js', to: 'orders-close.js' },
  { from: 'orders/[id]/customers/index.js', to: 'orders-customers.js' },
  {
    from: 'orders/[id]/customers/[customerId].js',
    to: 'orders-customer-detail.js'
  },
  { from: 'kitchen/index.js', to: 'kitchen.js' },
  { from: 'shifts/index.js', to: 'shifts-list.js' },
  { from: 'shifts/current.js', to: 'shifts-current.js' },
  { from: 'shifts/[id]/index.js', to: 'shifts-detail.js' },
  { from: 'shifts/[id]/close.js', to: 'shifts-close.js' },
  { from: 'panel/daily.js', to: 'panel-daily.js' },
  { from: 'panel/alerts.js', to: 'panel-alerts.js' },
  { from: 'cron/archive-old-orders.js', to: 'cron-archive.js' }
];

if (!existsSync(handlersDir)) {
  mkdirSync(handlersDir, { recursive: true });
}

let moved = 0;
let skipped = 0;

for (const { from, to } of moves) {
  const fromPath = join(apiRoot, from);
  const toPath = join(handlersDir, to);
  if (!existsSync(fromPath)) {
    console.warn(`  Skip: ${from} no existe`);
    skipped += 1;
    continue;
  }
  let content = readFileSync(fromPath, 'utf8');
  content = content.replace(
    /from\s+['"](\.\.\/)+_lib\/([^'"]+)['"]/g,
    "from '../_lib/$2'"
  );
  content = content.replace(
    /import\s+['"](\.\.\/)+_lib\/([^'"]+)['"]/g,
    "import '../_lib/$2'"
  );
  writeFileSync(toPath, content);
  unlinkSync(fromPath);
  console.log(`  ✓ ${from} → _handlers/${to}`);
  moved += 1;
}

const oldFolders = [
  'auth',
  'restaurant',
  'locales',
  'users',
  'ingredients',
  'dishes/[id]',
  'dishes',
  'tables',
  'orders/[id]/items/[itemId]',
  'orders/[id]/items',
  'orders/[id]/customers',
  'orders/[id]',
  'orders',
  'kitchen',
  'shifts/[id]',
  'shifts',
  'panel',
  'cron'
];

let folderRemoved = 0;
for (const folder of oldFolders) {
  const path = join(apiRoot, folder);
  if (!existsSync(path)) continue;
  try {
    const entries = readdirSync(path);
    if (entries.length === 0) {
      rmdirSync(path);
      console.log(`  ✓ borrada carpeta vacía: ${folder}`);
      folderRemoved += 1;
    } else {
      console.warn(`  ⊝ carpeta no vacía, conservada: ${folder} (${entries.length} archivos)`);
    }
  } catch (err) {
    console.warn(`  ✗ error en ${folder}: ${err.message}`);
  }
}

console.log(
  `\n${moved} archivos movidos, ${skipped} omitidos, ${folderRemoved} carpetas borradas.`
);
