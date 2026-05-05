/* RESTO — script destructivo para limpiar órdenes y dejar las mesas libres.

   Borra TODAS las órdenes de TODOS los locales del restaurante (incluidos
   takeouts) y resetea activeOrderId/openedAt en cada mesa.

   No toca: restaurante, locales (config), usuarios, carta, insumos,
   recetas, sesiones activas.

   Uso:
     node scripts/reset-orders.js
*/

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));
const saPath = join(__dirname, 'service-account.json');

if (!existsSync(saPath)) {
  console.error(`No se encontró ${saPath}.`);
  process.exit(1);
}

const sa = JSON.parse(readFileSync(saPath, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const RESTAURANT_ID = 'resto-demo';
const BATCH_SIZE = 400;

async function deleteAll(collectionRef) {
  const snap = await collectionRef.get();
  if (snap.empty) return 0;
  let count = 0;
  let batch = db.batch();
  for (const doc of snap.docs) {
    batch.delete(doc.ref);
    count += 1;
    if (count % BATCH_SIZE === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  if (count % BATCH_SIZE !== 0) {
    await batch.commit();
  }
  return count;
}

async function resetTables(tablesRef) {
  const snap = await tablesRef.get();
  if (snap.empty) return 0;
  let count = 0;
  let batch = db.batch();
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.activeOrderId || data.openedAt) {
      batch.update(doc.ref, { activeOrderId: null, openedAt: null });
      count += 1;
      if (count % BATCH_SIZE === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }
  }
  if (count % BATCH_SIZE !== 0) {
    await batch.commit();
  }
  return count;
}

async function main() {
  console.log(`\nReset de órdenes — restaurante "${RESTAURANT_ID}"\n`);

  const localesSnap = await db
    .collection('restaurants').doc(RESTAURANT_ID)
    .collection('locales').get();

  let totalOrders = 0;
  let totalTables = 0;

  for (const localeDoc of localesSnap.docs) {
    const localeId = localeDoc.id;
    const ordersDeleted = await deleteAll(localeDoc.ref.collection('orders'));
    const tablesReset = await resetTables(localeDoc.ref.collection('tables'));
    totalOrders += ordersDeleted;
    totalTables += tablesReset;
    console.log(
      `  ${localeId.padEnd(10)} órdenes eliminadas: ${String(ordersDeleted).padStart(3)}   mesas reseteadas: ${tablesReset}`
    );
  }

  console.log(
    `\nTotal: ${totalOrders} órdenes eliminadas, ${totalTables} mesa(s) reseteada(s).\n`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error en reset:', error);
    process.exit(1);
  });
