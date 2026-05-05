/* RESTO — seed inicial del restaurante demo.

   Crea el doc del restaurante, los 4 locales y los 6 usuarios iniciales con
   PIN hasheado (bcrypt cost 12). Es idempotente: los IDs son determinísticos
   y se hace `set({ merge: true })`, así que correrlo dos veces no duplica.

   Cómo correrlo:
     1. Generar service account desde Firebase Console y guardarlo como
        `scripts/service-account.json` (ignorado por git).
     2. npm install --prefix scripts
     3. node scripts/seed.js
*/

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import admin from 'firebase-admin';
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = join(__dirname, 'service-account.json');

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
} catch (error) {
  console.error(
    `\nNo se pudo leer ${serviceAccountPath}.\n` +
    `Generá el service account desde Firebase Console > Project Settings > Service Accounts ` +
    `y colocalo como scripts/service-account.json.\n`
  );
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const RESTAURANT_ID = 'resto-demo';
const BCRYPT_COST = 12;

const RESTAURANT = {
  name: 'RESTO Demo',
  owner: 'Propietario',
  plan: 'spark',
  currency: 'USD',
  timezone: 'America/Guayaquil',
  settings: {
    pricePerLocaleEnabled: false,
    targetMargin: 0.6
  }
};

const LOCALES = [
  { id: 'locale-1', name: 'Local Principal' },
  { id: 'locale-2', name: 'Local 2' },
  { id: 'locale-3', name: 'Local 3' },
  { id: 'locale-4', name: 'Local 4' }
];

const USERS = [
  {
    id: 'user-owner',
    pin: '1111',
    role: 'owner',
    name: 'Propietario',
    localeIds: ['locale-1', 'locale-2', 'locale-3', 'locale-4']
  },
  {
    id: 'user-manager',
    pin: '2222',
    role: 'manager',
    name: 'Encargado',
    localeIds: ['locale-1']
  },
  {
    id: 'user-cashier',
    pin: '5555',
    role: 'cashier',
    name: 'Cajero',
    localeIds: ['locale-1']
  },
  {
    id: 'user-waiter-1',
    pin: '3001',
    role: 'waiter',
    name: 'Mesero 1',
    localeIds: ['locale-1']
  },
  {
    id: 'user-cook',
    pin: '4444',
    role: 'cook',
    name: 'Cocinero',
    localeIds: ['locale-1']
  },
  {
    id: 'user-bar',
    pin: '6666',
    role: 'bar',
    name: 'Bar',
    localeIds: ['locale-1']
  }
];

async function seed() {
  console.log(`\nSembrando restaurante "${RESTAURANT_ID}"...\n`);

  const restaurantRef = db.doc(`restaurants/${RESTAURANT_ID}`);
  await restaurantRef.set(
    {
      ...RESTAURANT,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );
  console.log(`  Restaurante:   ${RESTAURANT_ID}`);

  for (const locale of LOCALES) {
    await restaurantRef.collection('locales').doc(locale.id).set(
      {
        name: locale.name,
        address: '',
        phone: '',
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    console.log(`  Local:         ${locale.id} — ${locale.name}`);
  }

  for (const user of USERS) {
    const pinHash = await bcrypt.hash(user.pin, BCRYPT_COST);
    await restaurantRef.collection('users').doc(user.id).set(
      {
        pinHash,
        role: user.role,
        name: user.name,
        localeIds: user.localeIds,
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    console.log(`  Usuario:       ${user.id.padEnd(14)} role=${user.role.padEnd(8)} PIN=${user.pin}`);
  }

  console.log('\nSeed completo.\n');
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\nError en el seed:');
    console.error(error);
    process.exit(1);
  });
