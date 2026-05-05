/* RESTO — router universal para /api/*.
   Una sola Vercel Function que despacha a los handlers en _handlers/.
   Esta consolidación nos mantiene dentro del límite de 12 functions del
   plan Hobby (cuenta como 1).

   Cada ruta es un patrón de segmentos. Los segmentos `:name` se inyectan
   en req.query.{name} para que los handlers existentes los lean igual
   que cuando vivían en archivos `[name].js`.

   Las rutas más específicas (con segmentos literales) deben ir antes que
   las rutas con segmentos dinámicos del mismo prefijo: el router devuelve
   el primer match. */

import authLogin from './_handlers/auth-login.js';
import authLogout from './_handlers/auth-logout.js';
import restaurant from './_handlers/restaurant.js';
import localesList from './_handlers/locales-list.js';
import localesDetail from './_handlers/locales-detail.js';
import usersList from './_handlers/users-list.js';
import usersDetail from './_handlers/users-detail.js';
import ingredientsList from './_handlers/ingredients-list.js';
import ingredientsDetail from './_handlers/ingredients-detail.js';
import dishesList from './_handlers/dishes-list.js';
import dishesDetail from './_handlers/dishes-detail.js';
import dishesRecipe from './_handlers/dishes-recipe.js';
import dishesOverrides from './_handlers/dishes-overrides.js';
import tablesList from './_handlers/tables-list.js';
import tablesDetail from './_handlers/tables-detail.js';
import ordersList from './_handlers/orders-list.js';
import ordersDetail from './_handlers/orders-detail.js';
import ordersItems from './_handlers/orders-items.js';
import ordersItemDetail from './_handlers/orders-item-detail.js';
import ordersItemReady from './_handlers/orders-item-ready.js';
import ordersSendToKitchen from './_handlers/orders-send-to-kitchen.js';
import ordersCancel from './_handlers/orders-cancel.js';
import ordersMoveItem from './_handlers/orders-move-item.js';
import ordersClose from './_handlers/orders-close.js';
import ordersCustomers from './_handlers/orders-customers.js';
import ordersCustomerDetail from './_handlers/orders-customer-detail.js';
import kitchen from './_handlers/kitchen.js';
import shiftsList from './_handlers/shifts-list.js';
import shiftsCurrent from './_handlers/shifts-current.js';
import shiftsDetail from './_handlers/shifts-detail.js';
import shiftsClose from './_handlers/shifts-close.js';
import panelDaily from './_handlers/panel-daily.js';
import panelAlerts from './_handlers/panel-alerts.js';
import cronArchive from './_handlers/cron-archive.js';

const ROUTES = [
  { pattern: ['auth', 'login'], handler: authLogin },
  { pattern: ['auth', 'logout'], handler: authLogout },

  { pattern: ['restaurant'], handler: restaurant },

  { pattern: ['locales'], handler: localesList },
  { pattern: ['locales', ':id'], handler: localesDetail },

  { pattern: ['users'], handler: usersList },
  { pattern: ['users', ':id'], handler: usersDetail },

  { pattern: ['ingredients'], handler: ingredientsList },
  { pattern: ['ingredients', ':id'], handler: ingredientsDetail },

  { pattern: ['dishes'], handler: dishesList },
  { pattern: ['dishes', ':id', 'recipe'], handler: dishesRecipe },
  { pattern: ['dishes', ':id', 'overrides'], handler: dishesOverrides },
  { pattern: ['dishes', ':id'], handler: dishesDetail },

  { pattern: ['tables'], handler: tablesList },
  { pattern: ['tables', ':id'], handler: tablesDetail },

  { pattern: ['orders'], handler: ordersList },
  { pattern: ['orders', ':id', 'items', ':itemId', 'ready'], handler: ordersItemReady },
  { pattern: ['orders', ':id', 'items', ':itemId'], handler: ordersItemDetail },
  { pattern: ['orders', ':id', 'items'], handler: ordersItems },
  { pattern: ['orders', ':id', 'send-to-kitchen'], handler: ordersSendToKitchen },
  { pattern: ['orders', ':id', 'cancel'], handler: ordersCancel },
  { pattern: ['orders', ':id', 'move-item'], handler: ordersMoveItem },
  { pattern: ['orders', ':id', 'close'], handler: ordersClose },
  { pattern: ['orders', ':id', 'customers', ':customerId'], handler: ordersCustomerDetail },
  { pattern: ['orders', ':id', 'customers'], handler: ordersCustomers },
  { pattern: ['orders', ':id'], handler: ordersDetail },

  { pattern: ['kitchen'], handler: kitchen },

  { pattern: ['shifts'], handler: shiftsList },
  { pattern: ['shifts', 'current'], handler: shiftsCurrent },
  { pattern: ['shifts', ':id', 'close'], handler: shiftsClose },
  { pattern: ['shifts', ':id'], handler: shiftsDetail },

  { pattern: ['panel', 'daily'], handler: panelDaily },
  { pattern: ['panel', 'alerts'], handler: panelAlerts },

  { pattern: ['cron', 'archive-old-orders'], handler: cronArchive }
];

function matchPattern(pattern, segments) {
  if (pattern.length !== segments.length) return null;
  const params = {};
  for (let i = 0; i < pattern.length; i += 1) {
    const p = pattern[i];
    const s = segments[i];
    if (p.startsWith(':')) {
      params[p.slice(1)] = s;
    } else if (p !== s) {
      return null;
    }
  }
  return params;
}

export default async function handler(req, res) {
  const slug = Array.isArray(req.query.slug) ? req.query.slug : [];

  for (const route of ROUTES) {
    const params = matchPattern(route.pattern, slug);
    if (params === null) continue;
    req.query = { ...req.query, ...params };
    return route.handler(req, res);
  }

  return res.status(404).json({ error: 'Endpoint no encontrado' });
}
