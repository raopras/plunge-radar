// Pure helpers for Plunge Radar. No network, no file system: easy to test.

export const REGIONS = {
  A: 'Eastern England',
  B: 'East Midlands',
  C: 'London',
  D: 'North Wales and Merseyside',
  E: 'West Midlands',
  F: 'North East',
  G: 'North West',
  H: 'Southern',
  J: 'South East',
  K: 'South Wales',
  L: 'South West',
  M: 'Yorkshire',
  N: 'South Scotland',
  P: 'North Scotland',
};

export const SLOT_MS = 30 * 60 * 1000;

/** Minutes ahead of UTC that UK clocks are at the given instant (0 in winter, 60 in summer). */
export function londonOffsetMinutes(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    timeZoneName: 'longOffset',
  }).formatToParts(date);
  const tz = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const m = tz.match(/GMT([+-])(\d{1,2}):?(\d{2})?/);
  if (!m) return 0;
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0));
}

/** UK calendar date (YYYY-MM-DD) for an instant. */
export function londonDateString(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Add whole days to a YYYY-MM-DD string. */
export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * The UTC instant of UK midnight at the start of a date.
 * UK clocks change at 01:00 UTC, never at midnight, so the offset at 00:00Z
 * on that date is the offset in force at local midnight.
 */
export function londonMidnightUTC(dateStr) {
  const guess = new Date(`${dateStr}T00:00:00Z`);
  return new Date(guess.getTime() - londonOffsetMinutes(guess) * 60000);
}

/** Half-hour slots in a UK day: 48 normally, 46 when clocks go forward, 50 when they go back. */
export function expectedSlots(dateStr) {
  const start = londonMidnightUTC(dateStr).getTime();
  const end = londonMidnightUTC(addDays(dateStr, 1)).getTime();
  return Math.round((end - start) / SLOT_MS);
}

/** ISO string in UTC with a trailing Z, to the minute, as the API expects. */
export function apiTime(date) {
  return date.toISOString().slice(0, 16) + 'Z';
}

/** Choose the current Agile import product from a products list. */
export function pickAgileProduct(products, now = new Date()) {
  const candidates = products.filter((p) => {
    const text = `${p.code} ${p.display_name ?? ''} ${p.full_name ?? ''}`;
    if (!/^AGILE/i.test(p.code)) return false;
    if (/OUTGOING|EXPORT/i.test(text)) return false;
    if (p.direction && p.direction !== 'IMPORT') return false;
    if (p.is_business) return false;
    if (p.available_to && new Date(p.available_to) <= now) return false;
    return true;
  });
  candidates.sort((a, b) => new Date(b.available_from) - new Date(a.available_from));
  return candidates[0] ?? null;
}

/** Map region letter to the single-rate electricity tariff code for that region. */
export function regionTariffCodes(productDetail) {
  const out = {};
  const tariffs = productDetail.single_register_electricity_tariffs ?? {};
  for (const letter of Object.keys(REGIONS)) {
    const entry = tariffs[`_${letter}`];
    const code = entry?.direct_debit_monthly?.code ?? (entry ? Object.values(entry)[0]?.code : null);
    out[letter] = code ?? `E-1R-${productDetail.code}-${letter}`;
  }
  return out;
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Place API rate records into a fixed array of slots for one UK day.
 * Index 0 is the half-hour starting at local midnight. Missing slots stay null.
 */
export function slotPrices(records, dateStr) {
  const start = londonMidnightUTC(dateStr).getTime();
  const n = expectedSlots(dateStr);
  const prices = new Array(n).fill(null);
  for (const r of records) {
    const from = new Date(r.valid_from).getTime();
    const to = r.valid_to ? new Date(r.valid_to).getTime() : from + SLOT_MS;
    // A record can cover several half-hours (other tariffs do this); fill each one.
    for (let t = from; t < to; t += SLOT_MS) {
      const idx = Math.round((t - start) / SLOT_MS);
      if (idx >= 0 && idx < n && typeof r.value_inc_vat === 'number') {
        prices[idx] = round2(r.value_inc_vat);
      }
    }
  }
  return prices;
}

/** Cheapest or dearest run of `width` consecutive known slots. */
export function bestWindow(prices, width, mode = 'min') {
  let best = null;
  for (let i = 0; i + width <= prices.length; i++) {
    const run = prices.slice(i, i + width);
    if (run.some((p) => p === null)) continue;
    const avg = run.reduce((a, b) => a + b, 0) / width;
    if (!best || (mode === 'min' ? avg < best.avg : avg > best.avg)) best = { start: i, end: i + width, avg: round2(avg) };
  }
  return best;
}

/** Runs of consecutive slots below zero: [{start, end (exclusive), min}]. */
export function negativeRuns(prices) {
  const runs = [];
  let cur = null;
  prices.forEach((p, i) => {
    if (p !== null && p < 0) {
      if (!cur) cur = { start: i, end: i + 1, min: p };
      else { cur.end = i + 1; cur.min = Math.min(cur.min, p); }
    } else if (cur) { runs.push(cur); cur = null; }
  });
  if (cur) runs.push(cur);
  return runs;
}

/** Plain numbers the page needs, worked out once at build time. */
export function summariseDay(prices) {
  const known = prices.filter((p) => p !== null);
  if (known.length === 0) return null;
  const min = Math.min(...known);
  const max = Math.max(...known);
  return {
    count: known.length,
    avg: round2(known.reduce((a, b) => a + b, 0) / known.length),
    min,
    minAt: prices.indexOf(min),
    max,
    maxAt: prices.indexOf(max),
    cheapest2h: bestWindow(prices, 4, 'min'),
    priciest2h: bestWindow(prices, 4, 'max'),
    negatives: negativeRuns(prices),
  };
}

/** True when every region holds a full day of prices for the date. */
export function dayIsComplete(dataset, dateStr) {
  const day = dataset?.days?.[dateStr];
  if (!day) return false;
  const n = expectedSlots(dateStr);
  return Object.keys(REGIONS).every((r) => {
    const prices = day.regions?.[r]?.prices;
    return Array.isArray(prices) && prices.length === n && prices.every((p) => p !== null);
  });
}

/**
 * True when every region has all the prices Octopus will publish for the date so far.
 * Agile prices run 11pm to 11pm, so a day's final hour (two half-hours) only arrives
 * with the next day's prices; those two may still be missing.
 */
export function dayIsPublished(dataset, dateStr) {
  const day = dataset?.days?.[dateStr];
  if (!day) return false;
  const n = expectedSlots(dateStr);
  return Object.keys(REGIONS).every((r) => {
    const prices = day.regions?.[r]?.prices;
    if (!Array.isArray(prices) || prices.length !== n) return false;
    const firstGap = prices.indexOf(null);
    return firstGap === -1 || (firstGap >= n - 2 && prices.slice(firstGap).every((p) => p === null));
  });
}
