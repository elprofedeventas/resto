# RESTO — Documento de Referencia

> **Este documento es la fuente única de verdad del producto RESTO.**
> Claude Code debe leerlo al inicio de cada sesión y consultarlo antes de tomar decisiones.
> Si algo no está aquí, **preguntar antes de asumir**.

---

## 1. Identidad del producto

### 1.1 Qué es RESTO

RESTO es una aplicación web (PWA) que lleva todo el negocio de un restaurante o cafetería: toma de órdenes, comandas a cocina, control de mesas, caja, inventario con recetas, costos vivos, y panel para el dueño. Funciona para una marca con uno hasta cuatro locales físicos.

Pertenece a la familia de aplicaciones de **Nueva Órbita**, junto con ORDEN PPP, BELLEZA, ROBINSON, DISTRIBUYE, AGRO, PÓLIZA, CAPITA, PROPIEDAD, ESTÉTICA, EDUCA, RESTOCAFÉ, PROFESIONAL, SERVICIOS.

### 1.2 Para quién es

El cliente ideal es el propietario de un restaurante, cafetería o bar pequeño-mediano en Ecuador, con uno a cuatro locales de la misma marca. No está en su escritorio — está caminando entre locales, atendiendo proveedores, viendo el WhatsApp, y necesita que la información del negocio le llegue **clara, en segundos, desde el celular**.

No es un cliente que quiere aprender un sistema. Es un cliente que quiere abrir la app, ver lo que importa, cerrar la app y seguir con su día.

### 1.3 Filosofía: lo que enamora al dueño

RESTO le quita seis dolores de cabeza:

1. **Las órdenes en papel se pierden o llegan incompletas a cocina.** RESTO digitaliza el flujo mesero → cocina sin papel.
2. **El dueño está ciego cuando no está en el local.** RESTO le da el local en el bolsillo, en tiempo real.
3. **Las compras se hacen por instinto, no por datos.** RESTO le dice qué se vendió, qué falta, qué sobra.
4. **Los precios de los insumos suben y nadie ajusta la carta.** RESTO recalcula márgenes solo cuando el dueño actualiza el precio del aceite, del pollo, del aceite de oliva.
5. **El margen se erosiona sin que nadie lo note.** RESTO alerta cuando un plato baja del margen objetivo.
6. **La información vive en cuatro lugares: papel, Excel, WhatsApp, sistema contable.** RESTO la junta en una sola pantalla.

**Frase guía:** *RESTO desaparece dolores de cabeza. No los administra, los desaparece.*

### 1.4 Lo que NO es RESTO

- No es un CRM. (En la familia Nueva Órbita nunca usamos esa palabra de cara al cliente.)
- No es un sistema contable. RESTO no reemplaza al contador.
- No es un sistema de facturación electrónica SRI en V1. (En V1 emite precuenta y recibo interno; integración con Dátil u otro proveedor llega en V2.)
- No es una plataforma de delivery. (En V1 maneja "para llevar" simple; el delivery completo con repartidores llega en V3.)
- No es Toast, Lightspeed ni Square. RESTO es para el restaurante ecuatoriano con uno a cuatro locales, no para una cadena de cien.

---

## 2. Stack técnico

### 2.1 Stack confirmado

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite |
| Hosting | Vercel |
| Backend ligero | Vercel serverless functions (cuando se necesite internet externo) |
| Backend pesado | Firebase Functions (cuando solo se manipula Firestore) |
| Base de datos | Firebase Firestore (plan Spark) |
| Almacenamiento de archivos | Firebase Storage (5 GB en Spark) |
| Autenticación | **PIN propio sobre Firestore** (no Firebase Auth) |
| Lenguaje | **JavaScript** (no TypeScript) |
| Estilos | **CSS Modules** (no Tailwind, no styled-components) |
| Tipografía | **Inter** (pesos 400, 500, 600) |

### 2.2 Reglas duras del stack

- **No agregar librerías sin preguntar primero.** Cada `npm install` requiere confirmación explícita.
- **No usar TypeScript.** El proyecto es JavaScript puro.
- **No usar Tailwind ni styled-components.** Solo CSS Modules.
- **No usar localStorage ni sessionStorage.** Estado en React state o en Firestore, nada en el browser persistente.
- **No usar Firebase Auth.** El auth es PIN propio sobre la colección `users`.
- **No usar bibliotecas de UI grandes** (Material-UI, Ant Design, Chakra, MUI). RESTO debe verse propio.
- **No usar React Router complejo si una alternativa más simple alcanza.**
- **Variables de entorno en `.env.local`** (nunca commitear). Hay un `.env.example` con las claves necesarias.

---

## 3. Arquitectura de datos (Firestore)

### 3.1 Modelo de colecciones

```
restaurants/                                ← un documento por cliente (un dueño = una marca)
  └── {restaurantId}/
       ├── (campos: name, owner, plan, currency, timezone, settings, createdAt)
       │
       ├── locales/                          ← 1 a 4 locales de la marca
       │    └── {localeId}/
       │         ├── (campos: name, address, phone, layout, active)
       │         ├── tables/                 ← mesas físicas con estado en tiempo real
       │         ├── orders/                 ← órdenes activas y cerradas (último año)
       │         ├── sales/                  ← cierres de orden con totales y pagos
       │         ├── inventory/              ← stock de insumos POR LOCAL
       │         ├── shifts/                 ← turnos (heredado de ROBINSON)
       │         ├── cashClosings/           ← cuadre diario de caja
       │         ├── expenses/               ← caja chica, gastos del día
       │         ├── kitchenEvents/          ← última actividad por estación (KDS)
       │         └── monthlyArchive/         ← órdenes de más de 1 año, comprimidas
       │
       ├── users/                            ← empleados con PIN, rol, locales asignados
       │    └── {userId}/
       │
       ├── menu/                             ← carta central (compartida entre locales)
       │    └── {dishId}/
       │         ├── (campos: name, basePrice, category, station, active, photoUrl)
       │         └── localOverrides/         ← precios distintos por local si el dueño activó la opción
       │
       ├── ingredients/                      ← insumos centrales con precios actuales
       │    └── {ingredientId}/
       │         ├── (campos: name, unit, currentPrice, priceHistory, supplier)
       │
       ├── recipes/                          ← receta de cada plato (plato ↔ insumos con cantidades)
       │    └── {dishId}/
       │
       ├── suppliers/                        ← proveedores
       │
       └── customers/                        ← clientes frecuentes (cross-local)
            └── {customerId}/

audit/                                       ← log global de cambios sensibles
notifications/                               ← alertas pendientes para el panel del dueño
```

### 3.2 Convenciones de naming

- **Colecciones:** inglés, plural, lowercase: `restaurants`, `locales`, `tables`, `orders`, `dishes`, `ingredients`, `recipes`.
- **Documentos:** ID legible cuando sea posible (`PIN-3001`, `M07`, `ORD-2026-05-04-001`), o ID generado por Firestore cuando no.
- **Campos:** inglés, camelCase: `createdAt`, `dishId`, `priceOverride`, `tableNumber`, `waiterPin`.
- **Timestamps:** siempre `serverTimestamp()` de Firestore, nunca `new Date()` del cliente.

### 3.3 Reglas de seguridad

Las reglas de Firestore (`firestore.rules`) son **parte del producto, no un detalle**. Cada vez que se cree o modifique una colección, las reglas se actualizan en la misma sesión.

**Principio:** el frontend habla directo con Firestore (no hay proxy en medio como con GAS). La seguridad vive en las reglas. Si las reglas están mal, los datos están expuestos.

**Reglas base (a refinar en construcción):**
- Solo usuarios autenticados con PIN válido pueden leer/escribir.
- Un mesero solo puede leer/escribir órdenes y mesas del local al que está asignado.
- Solo el rol Admin puede modificar la carta, los precios y los insumos.
- Solo el rol Admin puede ver `sales/`, `cashClosings/`, `expenses/`.
- Las reglas de cocina (rol Cook) solo permiten cambiar `estadoCocina` de items, no precios ni totales.

### 3.4 Optimización de cuota Firestore Spark

Firestore Spark da 50K lecturas / 20K escrituras / 1 GB total / día. Para no quemar cuota:

- **Listeners siempre con cleanup en useEffect** — si un componente se desmonta y deja un listener vivo, es fuga garantizada.
- **No leer documentos que no se necesitan.** Filtrar en query, no en cliente.
- **Datos por local viven en subcolecciones del local**, no en colecciones planas globales. Esto evita que un listener cargue datos de los 4 locales cuando solo necesita uno.
- **Archivar órdenes de más de 1 año** a `monthlyArchive/{YYYY-MM}` con resumen comprimido (no orden por orden). Proceso programado mensual.
- **No crear documentos sin pensar el costo de lectura.** Antes de crear una colección nueva, preguntar: "¿esto se va a leer 100 veces al día? ¿está optimizado?".

---

## 4. Los 5 módulos

RESTO se compone de cinco módulos. Cada uno es una unidad de producto con sus propias pantallas internas.

### 4.1 CARTA — el cerebro

El menú con precios de venta y costos reales calculados desde la receta.

**Hace:**
- Lista de platos con foto, precio, categoría, estación de cocina (caliente, fría, bar).
- Edición de receta por plato (insumos con cantidades).
- Cálculo automático de costo del plato basado en precio actual de los insumos.
- Cálculo automático de margen y alerta cuando baja del objetivo (configurable por el dueño).
- Activar/desactivar plato (sin borrarlo).
- Variantes de precio (media, entera, individual, familiar).
- Override de precio por local si el dueño activó esa opción global.

**No hace en V1:**
- Combos estructurados (entrada + plato + bebida + postre como un solo ítem).
- Modificadores estructurados ("sin cebolla" como botón). En V1 son observaciones libres del mesero.
- Subrecetas (la salsa madre que rinde para 40 platos). En V1 las recetas son planas.

### 4.2 MESA — el salón

El mesero toma la orden desde su celular o tablet.

**Hace:**
- Plano visual del salón con mesas pintadas según estado (libre, ocupada, por cobrar).
- Las mesas cambian de color por tiempo de permanencia (verde fresco, amarillo si lleva 1h, rojo si lleva 2h+).
- Abrir mesa, agregar items con observaciones, enviar a cocina.
- Mover items entre mesas ("yo invito el plato").
- Dividir cuenta entre comensales.
- Cerrar mesa (pasa a Caja).
- Tipo de orden: mesa o para llevar.

**No hace en V1:**
- Reservas con calendario.
- Carta digital con QR que el cliente escanea.
- Asignación automática de mesa por mesero (en V1 cualquier mesero puede tomar cualquier mesa de su local).

### 4.3 COCINA — el KDS

Pantalla siempre encendida en cocina (tablet o computador viejo). Las comandas aparecen solas.

**Hace:**
- Cada comanda es una tarjeta con cronómetro vivo.
- Color de la tarjeta cambia: blanco (recién entró), amarillo (10 min), rojo (20 min).
- Cocinero toca "✓ Listo" por item o por orden completa.
- Filtro por estación: cocina caliente, cocina fría, bar.
- Cuando todos los items de una orden están listos, la orden pasa a "servida" y el mesero recibe notificación.
- En el panel del dueño aparece "hay 2 comandas con más de 15 minutos en cocina del local 2".

**No hace en V1:**
- Impresora térmica de tickets (V2).
- Notificaciones push externas (en V1 el mesero ve la notificación dentro de la app, no como push).

### 4.4 CAJA — el cierre

El cajero cobra y cierra la mesa.

**Hace:**
- Ver mesas con cuenta pendiente.
- Ver detalle de la mesa, aplicar descuentos.
- Cobrar con múltiples métodos en una sola venta (efectivo + tarjeta + transferencia).
- Calcular propina sugerida (10%, configurable).
- Emitir precuenta y recibo interno (no factura electrónica en V1).
- Cierre de caja diario con cuadre (efectivo declarado vs. teórico, alertas si hay diferencia).
- Conciliación por método de pago: cuánto entró por efectivo, cuánto por tarjeta, cuánto por transferencia, cuánto por apps (Uber Eats, Pedidos Ya en V3).

**No hace en V1:**
- Facturación electrónica SRI (V2 con Dátil u otro proveedor).
- Devoluciones complejas (en V1 una orden anulada se marca como anulada y queda en el histórico).

### 4.5 PANEL — el bolsillo del dueño

Lo que el propietario ve cuando abre la app.

**Hace:**
- Dashboard del día: ventas, ticket promedio, plato estrella, plato menos vendido, margen bruto, propinas, mesas atendidas.
- Comparativo: ayer, mismo día semana pasada, mismo día mes pasado.
- Vista consolidada multi-local: si tiene 4 locales, ve los 4 sumados Y puede entrar al detalle de cada uno.
- Alertas: stock bajo, margen en riesgo, comandas demoradas, cuadre con diferencia.
- "¿Cuánto te quedó limpio ayer?" — venta del día menos costo de insumos consumidos (según recetas) menos sueldos prorrateados menos servicios fijos prorrateados.
- Top 3 meseros por venta y por ticket promedio.
- Histórico: ventas por semana, mes, año.

**No hace en V1:**
- BI predictivo (predicción de no-show, recomendación de carta). Esto puede llegar en V2/V3 con Claude API, similar a BELLEZA.
- Reportes contables exportables a SRI.

---

## 5. Roles y permisos

Auth con PIN de 4 dígitos. Convención inicial:

| Rol | PIN inicial | Qué puede hacer |
|-----|-------------|-----------------|
| Owner (Propietario) | 1111 | Todo. Ver todos los locales, configurar carta, ver finanzas. |
| Manager (Encargado) | 2222 | Operación de su local. No puede cambiar carta ni ver consolidado de otros locales. |
| Cashier (Cajero) | 5555 | Cobrar, dividir cuentas, cerrar mesa, hacer cuadre de caja. |
| Waiter (Mesero) | 3001, 3002, 3003... | PIN individual por mesero. Tomar órdenes solo en su local. Ranking de ventas usa este PIN. |
| Cook (Cocina) | 4444 | Ver KDS de su estación, marcar items listos. |
| Bar | 6666 | Ver KDS de bar, marcar bebidas listas. |

PINs son configurables por el dueño en setup. Los iniciales son solo para arranque.

---

## 6. Decisiones de producto cerradas

Estas decisiones ya están tomadas y no se reabren sin discusión explícita con Alfredo.

| # | Decisión | Versión |
|---|----------|---------|
| 1 | Plano visual de mesas (no lista de zonas) | V1 |
| 2 | Dashboard consolidado multi-local | V1 |
| 3 | KDS con cronómetro y semáforo de tiempos | V1 |
| 4 | Sin facturación electrónica SRI | V1 (V2 con proveedor) |
| 5 | Sin delivery con repartidores | V1 (V3) |
| 6 | Tipos de orden: mesa y para llevar | V1 |
| 7 | Multi-local: 1 a 4 locales misma marca, una sola instalación | V1 |
| 8 | Inventario por local, sin transferencias entre locales | V1 (V2 transferencias) |
| 9 | Override de precio por local activable con un toggle global del dueño | V1 |
| 10 | Carta central, no por local | V1 |
| 11 | Variantes de precio (media/entera) | V1 |
| 12 | Modificadores estructurados | V2 |
| 13 | Combos estructurados | V2 |
| 14 | Subrecetas (mise en place) | V2 |
| 15 | Auth con PIN propio (no Firebase Auth) | V1 |
| 16 | Clientes frecuentes a nivel marca (cross-local) | V1 |
| 17 | Programa de fidelización con puntos | V2 |
| 18 | Carta digital QR (cliente escanea) | V2 |
| 19 | Reservas con calendario | V2 |
| 20 | BI predictivo con Claude API | V3 |
| 21 | Archivar órdenes de más de 1 año en `monthlyArchive` | V1 (proceso recurrente) |

---

## 7. Sistema de diseño

### 7.1 Filosofía visual

Tres palabras: **precisión, facilidad, pulcritud.**

- Densidad de información alta pero ordenada.
- Bordes sutiles, no sombras pesadas.
- Bordes redondeados moderados (4–6 px, no 16 px).
- Espaciado generoso entre secciones, ajustado dentro de cada sección.
- Sin gradientes vistosos.
- Sin emojis en la UI de producción (sí pueden usarse en mensajes salientes de WhatsApp).

### 7.2 Paleta

```css
/* Fondos */
--bg-app:        #FAFAF7;   /* fondo principal, blanco hueso */
--bg-surface:    #FFFFFF;   /* tarjetas, modales */
--bg-active:     #EFF6FF;   /* mesa ocupada, fila seleccionada */

/* Texto */
--text-primary:    #1A1F2E;
--text-secondary:  #6B7280;
--text-disabled:   #9CA3AF;

/* Bordes */
--border-light:    #E5E7EB;
--border-medium:   #D1D5DB;

/* Color primario (acción) */
--primary:         #1E40AF;
--primary-hover:   #1E3A8A;
--primary-light:   #DBEAFE;

/* Estados */
--success:         #059669;   /* mesa libre, comanda lista */
--warning:         #D97706;   /* 10 min en cocina */
--danger:          #DC2626;   /* 20 min, urge */
--success-light:   #D1FAE5;
--warning-light:   #FEF3C7;
--danger-light:    #FEE2E2;
```

### 7.3 Tipografía

Una sola fuente: **Inter**.

```css
--font-base:    'Inter', -apple-system, sans-serif;
--font-weight-regular:  400;
--font-weight-medium:   500;
--font-weight-semibold: 600;

/* Escalas */
--text-xs:   12px;  /* metadatos, timestamps */
--text-sm:   14px;  /* texto secundario */
--text-base: 16px;  /* texto principal */
--text-lg:   18px;  /* énfasis */
--text-xl:   22px;  /* títulos de sección */
--text-2xl:  28px;  /* números importantes (totales, contadores) */
```

### 7.4 Componentes base

Cuando se construyan, vivirán en `web/src/components/`:

- `Button` (variantes: primary, secondary, ghost, danger)
- `Input`, `Select`, `Textarea`
- `Card`
- `Modal`
- `Toast` (notificaciones efímeras)
- `Badge` (estados de mesa, estados de comanda)
- `Table` (listas tabulares)
- `EmptyState`
- `LoadingSpinner`
- `Avatar` (inicial del nombre del mesero)

---

## 8. Convenciones de código

### 8.1 Estructura de carpetas

```
resto/
├── web/                      # frontend React + Vite
│   ├── src/
│   │   ├── components/       # UI reutilizable (Button, Card, Modal, etc.)
│   │   ├── modules/          # un folder por módulo de producto
│   │   │   ├── menu/         # CARTA
│   │   │   ├── tables/       # MESA
│   │   │   ├── kitchen/      # COCINA
│   │   │   ├── cashier/      # CAJA
│   │   │   └── panel/        # PANEL
│   │   ├── services/         # capa que habla con Firebase
│   │   │   ├── firestore.js  # cliente Firestore inicializado
│   │   │   ├── auth.js       # login con PIN
│   │   │   ├── menu.js       # CRUD de carta
│   │   │   ├── orders.js     # CRUD de órdenes
│   │   │   └── ...
│   │   ├── hooks/            # custom hooks (useAuth, useLocale, etc.)
│   │   ├── styles/           # variables CSS globales, reset, tipografías
│   │   ├── utils/            # helpers (formatCurrency, formatTime, etc.)
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── public/
│   ├── .env.example
│   ├── package.json
│   └── vite.config.js
│
├── functions/                # Firebase Functions (lógica que solo toca Firestore)
│   └── src/
│       └── index.js
│
├── firestore.rules
├── firestore.indexes.json
├── firebase.json
├── .gitignore
├── README.md
└── RESTO.md                  # este documento
```

### 8.2 Reglas de código

- **Componentes nunca tocan Firestore directo.** Siempre pasan por `services/`.
- **Cada listener Firestore tiene su cleanup.** El `useEffect` siempre retorna la función de unsubscribe.
- **Código en inglés** (variables, funciones, archivos). **UI en español neutro.**
- **No mezclar lógica de negocio en componentes.** La lógica vive en `services/` o `hooks/`.
- **No anidar más de 4 niveles de subcolecciones en Firestore.**
- **Nombres de archivos:** PascalCase para componentes (`MenuList.jsx`), camelCase para utilidades (`formatCurrency.js`).
- **Imports absolutos** desde `src/` cuando ayuden a la legibilidad (configurar alias en Vite).

---

## 9. Reglas para Claude Code

Esta sección es para Claude Code específicamente. Léela al inicio de cada sesión.

### 9.1 Qué hacer siempre

- **Leer este `RESTO.md` completo** antes de tocar cualquier archivo.
- **Preguntar antes de asumir** cuando algo no esté claro.
- **Escribir código en JavaScript** (no TypeScript), **CSS Modules** (no Tailwind), **español neutro** en UI.
- **Respetar la estructura de carpetas** definida en sección 8.1.
- **Pasar por `services/`** para todas las lecturas y escrituras a Firebase.
- **Cerrar listeners** en `useEffect` cleanup.
- **Actualizar `firestore.rules`** cada vez que se cree o modifique una colección.
- **Listar al final de cada cambio** los archivos modificados, en una línea por archivo.
- **Confirmar PINs y permisos** cuando se construya un módulo nuevo.

### 9.2 Qué nunca hacer

- **No tocar archivos que no se hayan pedido explícitamente.** Cuidado, no toques nada que no te pida.
- **No "limpiar" ni "refactorizar" código existente sin que se pida.**
- **No agregar librerías** sin preguntar primero (`npm install` requiere confirmación).
- **No crear archivos de prueba** (`*.test.js`) salvo que se pida explícitamente.
- **No cambiar la estructura de carpetas** sin preguntar.
- **No usar emojis en la UI de producción.**
- **No escribir nada en TypeScript.**
- **No usar Tailwind, styled-components, ni librerías de UI grandes.**
- **No usar localStorage ni sessionStorage.**
- **No usar Firebase Auth** (auth es PIN propio).
- **No subir `.env` ni claves al repo.**
- **No incluir datos reales de clientes** en seed o ejemplos.
- **No usar regionalismos** argentinos ni mexicanos (sin "vos", "decís", "checá", "platicar"). Español neutro siempre.
- **No escribir el nombre del producto como "Resto" o "ResTO".** Es **RESTO** siempre, todo en mayúsculas.
- **No mezclar datos centrales con datos por local.** Respetar la estructura de Firestore de la sección 3.

### 9.3 Cuando algo no esté claro

Cuando una instrucción no esté clara o falte información para tomar una decisión, **detenerse y preguntar a Alfredo.** Nunca inventar.

Formato sugerido de pregunta:

> "Antes de continuar, necesito confirmar X. Tengo dos opciones: A o B. Mi recomendación es A porque [razón]. ¿Procedo con A o prefieres B?"

### 9.4 Después de cualquier cambio significativo

Listar al final de la respuesta, en una línea por archivo, los archivos creados o modificados:

```
Archivos modificados:
- web/src/modules/menu/MenuList.jsx
- web/src/services/menu.js
- firestore.rules
```

Esto permite a Alfredo saber exactamente qué tocó Claude Code en cada turno.

---

## 10. Roadmap por fases

### Fase 1 — MVP funcional (V1)

El restaurante puede operar de punta a punta sin papel.

1. **Setup inicial**
   - Estructura del repo (web + functions + firestore config).
   - Inicialización de Firebase (Firestore, Storage).
   - Variables de entorno y `.env.example`.
   - Sistema de diseño base (variables CSS, tipografía Inter, componentes Button, Card, Input, Modal).
   - Reglas de Firestore base.

2. **Auth con PIN**
   - Pantalla de login con teclado numérico.
   - Manejo de sesión (en memoria + cookie segura, no localStorage).
   - Hook `useAuth` con rol y local asignado.

3. **Configuración inicial del restaurante**
   - Wizard de setup: nombre del restaurante, locales (1 a 4), carta inicial, insumos básicos.
   - Asignación de PINs a usuarios.
   - Toggle de "override de precio por local".

4. **Módulo CARTA**
   - CRUD de platos (nombre, precio, categoría, estación, foto).
   - CRUD de insumos (nombre, unidad, precio actual).
   - Editor de receta por plato (insumos con cantidades).
   - Cálculo automático de costo y margen.
   - Activar/desactivar plato.
   - Override de precio por local (si está activado).

5. **Módulo MESA**
   - Editor de plano visual de mesas (drag & drop simple).
   - Pantalla de mesero con plano del salón.
   - Abrir mesa, agregar items con observaciones, enviar a cocina.
   - Estados de mesa con colores por tiempo.
   - Mover items entre mesas, dividir cuenta.

6. **Módulo COCINA (KDS)**
   - Pantalla de cocina con tarjetas de comanda.
   - Cronómetro vivo, semáforo de tiempos.
   - Filtro por estación (caliente, fría, bar).
   - Marcar item listo, marcar orden lista.

7. **Módulo CAJA**
   - Cobrar mesa con múltiples métodos de pago.
   - Aplicar descuentos.
   - Emitir precuenta y recibo interno.
   - Cierre de caja diario con cuadre.

8. **Módulo PANEL**
   - Dashboard del día por local.
   - Vista consolidada multi-local.
   - Alertas: stock bajo, margen en riesgo, comandas demoradas.
   - "¿Cuánto te quedó limpio ayer?".
   - Top meseros, plato estrella, comparativos.

9. **Proceso de archivado mensual**
   - Firebase Function programada que comprime órdenes de más de 1 año a `monthlyArchive`.

### Fase 2 — Profundización (V2)

- Facturación electrónica SRI (integración con Dátil u otro proveedor).
- Modificadores estructurados ("sin cebolla" como botón).
- Combos estructurados.
- Subrecetas (mise en place).
- Transferencias de inventario entre locales.
- Programa de fidelización con puntos.
- Carta digital con QR (cliente escanea desde la mesa).
- Reservas con calendario.
- Notificaciones push.
- Impresora térmica opcional.

### Fase 3 — Inteligencia (V3)

- BI predictivo con Claude API: predicción de demanda, recomendación de carta, alerta de cliente perdido.
- Delivery completo: asignación de repartidores, ruta, propinas separadas.
- Integración con apps de delivery (Uber Eats, Pedidos Ya): pedidos entran a una sola pantalla.
- Análisis de mermas con visión computacional.
- Asistente conversacional en el panel del dueño ("¿cómo voy hoy comparado con la semana pasada?").

---

## 11. Glosario

- **Comanda:** la orden enviada a cocina. Una orden de mesa puede generar varias comandas (una a cocina caliente, una al bar).
- **KDS:** Kitchen Display System. Pantalla en cocina que muestra las comandas pendientes.
- **Mise en place:** preparaciones que se hacen antes del servicio (salsas madre, cortes, marinados). Llega en V2.
- **Estación:** zona de cocina que prepara cierto tipo de items (cocina caliente, cocina fría, bar, parrilla).
- **Override de precio:** posibilidad de que un local cobre un plato a precio distinto al base de la carta.
- **Cuadre de caja:** comparación al cierre del día entre el efectivo declarado y el teórico según las ventas registradas.

---

**Última revisión:** 4 de mayo de 2026
**Mantenido por:** Alfredo Pérez — Nueva Órbita
