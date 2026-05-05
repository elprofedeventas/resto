/* RESTO — carga manual de .env.local para desarrollo con `vercel dev`.

   Vercel dev (cuando el proyecto no está linkeado al cloud) no inyecta las
   variables de .env.local a las API functions. Este módulo lee el archivo
   y las pega a process.env si todavía no existen.

   En producción Vercel, .env.local no se sube al deploy; el runtime de
   Vercel inyecta las env vars desde el dashboard. Este loader detecta que
   el archivo no existe y queda inerte.

   Importa este módulo PRIMERO en cada API handler:
     import '../_lib/loadEnv.js';
     import { ... } from '...';
*/

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const envPath = path.resolve(process.cwd(), '.env.local');

if (existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf8');
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq < 1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    // Quitar comillas envoltorias.
    if (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}
