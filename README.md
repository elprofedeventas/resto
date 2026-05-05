# RESTO

Aplicación web (PWA) para la operación integral de restaurantes y cafeterías de 1 a 4 locales de la misma marca.

Forma parte de la familia de aplicaciones de Nueva Órbita.

La fuente única de verdad del producto es [`RESTO.md`](./RESTO.md). Cualquier decisión de producto, stack, estructura de datos o convención de código vive ahí.

## Stack

React 18 + Vite (JavaScript, CSS Modules) sobre Firebase Firestore + Storage. Auth por PIN propio. Hosting en Vercel.

## Estructura

- `web/` — frontend React + Vite
- `firestore.rules`, `firestore.indexes.json`, `firebase.json`, `.firebaserc` — configuración de Firestore
- `RESTO.md` — documento maestro del producto
