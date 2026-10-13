#!/usr/bin/env node
// Checks the LIVE site the way a visitor would see it, not just whether the code ran:
// pages load, referral links are in place, and the price data is fresh.
// Run by .github/workflows/health-check.yml; any problem fails the run, which opens
// a GitHub issue (GitHub emails the repo owner).

import { fileURLToPath } from 'node:url';
import { addDays, dayIsPublished, londonDateString } from './lib.mjs';

const REFERRAL = 'https://share.octopus.energy/silk-snail-210';
const PAGES = ['/', '/london/', '/octopus-tariffs/', '/octopus-tariffs/agile/', '/electric-car-charging-cost/', '/disclaimer/'];

export async function check({ base = 'https://plungeradar.co.uk', now = new Date(), fetchImpl = fetch } = {}) {
  const problems = [];
  const get = async (path) => {
    const res = await fetchImpl(`${base}${path}${path.includes('?') ? '&' : '?'}hc=${now.getTime()}`, { headers: { 'Cache-Control': 'no-cache' } });
    return res;
  };
  const ukHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', hourCycle: 'h23' }).format(now));
  const today = londonDateString(now);
  const tomorrow = addDays(today, 1);

  for (const p of PAGES) {
    try {
      const res = await get(p);
      if (!res.ok) { problems.push(`${p} returned HTTP ${res.status}`); continue; }
      const html = await res.text();
      if (p !== '/disclaimer/' && !html.includes(REFERRAL)) problems.push(`${p} has no referral link`);
    } catch (err) { problems.push(`${p} didn't load (${err.message})`); }
  }

  try {
    const res = await get('/data/latest.json');
    const data = res.ok ? await res.json() : null;
    if (!data) problems.push('data/latest.json is missing');
    else {
      // Allow the first hour after midnight for the overnight update.
      if (ukHour >= 1 && !dayIsPublished(data, today)) problems.push(`Agile prices for today (${today}) are missing or incomplete`);
      // Octopus Energy publishes between 4pm and 8pm; allow until 9pm.
      if (ukHour >= 21 && !dayIsPublished(data, tomorrow)) problems.push(`Agile prices for tomorrow (${tomorrow}) are missing at ${ukHour}:00`);
    }
  } catch (err) { problems.push(`data/latest.json didn't load (${err.message})`); }

  try {
    const res = await get('/data/tariffs.json');
    const t = res.ok ? await res.json() : null;
    if (!t) problems.push('data/tariffs.json is missing');
    else {
      const age = (now - new Date(t.generatedAt)) / 36e5;
      if (age > 36) problems.push(`tariff rates are ${Math.round(age)} hours old`);
      const latest = t.regions?.C?.tracker?.rates?.[0]?.d;
      if (!latest || latest < addDays(today, -1)) problems.push(`Octopus Tracker prices stop at ${latest || 'nothing'} (the Tracker product code may have changed)`);
      for (const key of ['agile', 'go', 'flexible']) if (!t.regions?.C?.[key]) problems.push(`tariff rates for ${key} are missing`);
    }
  } catch (err) { problems.push(`data/tariffs.json didn't load (${err.message})`); }

  return problems;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  check({ base: process.env.SITE_URL || undefined }).then((problems) => {
    if (problems.length) {
      console.error(`Health check found ${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
      process.exit(1);
    }
    console.log('Health check passed: pages, referral links and price data are all fine.');
  });
}
