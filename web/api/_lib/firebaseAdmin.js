/* RESTO — inicialización de Firebase Admin SDK para las Vercel Functions.
   Singleton: la primera llamada inicializa, las siguientes reutilizan. */

import './loadEnv.js';
import admin from 'firebase-admin';

let firestore;

function init() {
  if (admin.apps.length > 0) return;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_JSON no está definida. Corre node scripts/setup-env.js.'
    );
  }

  let credentials;
  try {
    credentials = JSON.parse(raw);
  } catch (error) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON tiene formato inválido.');
  }

  admin.initializeApp({
    credential: admin.credential.cert(credentials)
  });
}

export function getDb() {
  init();
  if (!firestore) {
    firestore = admin.firestore();
  }
  return firestore;
}

export { admin };
