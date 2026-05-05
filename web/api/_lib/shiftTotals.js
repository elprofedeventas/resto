/* RESTO — calcula los totales de un turno a partir de las ventas asociadas. */

function round2(n) {
  return Math.round(n * 100) / 100;
}

const METHODS = ['cash', 'card', 'transfer', 'app'];

export async function computeShiftTotals(localeRef, shiftId) {
  const salesSnap = await localeRef
    .collection('sales')
    .where('shiftId', '==', shiftId)
    .get();

  const payments = {};
  for (const m of METHODS) payments[m] = { count: 0, total: 0 };

  let totalSales = 0;
  let totalChange = 0;
  let totalTips = 0;
  let salesCount = 0;

  for (const doc of salesSnap.docs) {
    const s = doc.data();
    salesCount += 1;
    totalSales += s.totalToPay || 0;
    totalChange += s.change || 0;
    totalTips += s.tip || 0;
    if (Array.isArray(s.payments)) {
      for (const p of s.payments) {
        if (!METHODS.includes(p.method)) continue;
        payments[p.method].count += 1;
        payments[p.method].total += p.amount || 0;
      }
    }
  }

  for (const m of METHODS) {
    payments[m].total = round2(payments[m].total);
  }

  return {
    salesCount,
    payments,
    totalSales: round2(totalSales),
    totalChange: round2(totalChange),
    totalTips: round2(totalTips)
  };
}
