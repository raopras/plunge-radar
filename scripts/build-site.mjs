#!/usr/bin/env node
// Builds the published site into _site/:
//   - copies site/ as is (home page, app, data, icons)
//   - writes one landing page per region, e.g. _site/london/index.html, with today's
//     prices written into the HTML so search engines and link previews see real numbers
//   - adds a "today across Great Britain" table linking every region
//   - writes sitemap.xml
//
// Runs after scripts/fetch-prices.mjs in the GitHub Action. No dependencies.

import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { addDays, londonDateString } from './lib.mjs';
import { disclaimerPage } from './legal.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SLOT = 30 * 60 * 1000;
const TZ = 'Europe/London';

const fmtTime = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const fmtLong = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
const fmtShort = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' });
const fmtStamp = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pence = (p, dp = 1) => (p === null || p === undefined ? '–' : (p < 0 ? '−' : '') + Math.abs(p).toFixed(dp) + 'p');
const ordinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
const slotStart = (day, i) => new Date(Date.parse(day.start) + i * SLOT);
const range = (day, a, b) => `${fmtTime.format(slotStart(day, a))}–${fmtTime.format(slotStart(day, b))}`;
const sentenceCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);

async function loadRegions(siteDir) {
  await import(pathToFileURL(join(siteDir, 'regions.js')).href);
  return globalThis.PlungeRegions;
}

async function readJSON(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return null; }
}

/** Per-region history from the compact archive files, newest first. */
async function loadHistory(siteDir) {
  const dir = join(siteDir, 'data', 'archive');
  let files = [];
  try { files = (await readdir(dir)).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse().slice(0, 30); } catch { /* none yet */ }
  const days = [];
  for (const f of files) {
    const j = await readJSON(join(dir, f));
    if (j && j.regions) days.push(j);
  }
  return days;
}

function dayStats(prices) {
  const known = prices.filter((p) => p !== null);
  if (!known.length) return null;
  return {
    avg: known.reduce((a, b) => a + b, 0) / known.length,
    min: Math.min(...known),
    negatives: known.filter((p) => p < 0).length,
  };
}

/**
 * Per-region price history for the savings calculator: every archived day since the
 * start of the current price cap period, written to data/history/<letter>.json.
 */
async function writeCalculatorHistory(siteDir, outDir, PR) {
  globalThis.window ??= globalThis;
  await import(pathToFileURL(join(siteDir, 'config.js')).href + `?t=${Date.now()}`);
  const cap = globalThis.PLUNGE_CONFIG?.priceCap;
  if (!cap?.from) return 0;
  const dir = join(siteDir, 'data', 'archive');
  let files = [];
  try { files = (await readdir(dir)).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f.slice(0, 10) >= cap.from && f.slice(0, 10) <= cap.to).sort(); } catch { /* none yet */ }
  const days = [];
  for (const f of files) { const j = await readJSON(join(dir, f)); if (j?.regions) days.push(j); }
  await mkdir(join(outDir, 'data', 'history'), { recursive: true });
  for (const k of Object.keys(PR.REGIONS)) {
    const list = days.filter((d) => Array.isArray(d.regions[k]) && d.regions[k].every((p) => p !== null))
      .map((d) => ({ d: d.date, p: d.regions[k] }));
    await writeFile(join(outDir, 'data', 'history', `${k}.json`), JSON.stringify({ capFrom: cap.from, days: list }) + '\n');
  }
  return days.length;
}

// ---- HTML pieces ------------------------------------------------------------

function compareSection(dataset, dayKey, PR, prefix, current) {
  const day = dataset.days[dayKey];
  const rows = Object.keys(PR.REGIONS)
    .map((k) => ({ k, r: PR.REGIONS[k], s: day.regions[k]?.summary }))
    .filter((x) => x.s)
    .sort((a, b) => a.s.avg - b.s.avg);
  const gbAvg = rows.reduce((a, x) => a + x.s.avg, 0) / rows.length;
  const body = rows.map((x, i) => {
    const cur = x.k === current;
    const win = x.s.cheapest2h ? range(day, x.s.cheapest2h.start, x.s.cheapest2h.end) : '–';
    return `<tr${cur ? ' class="is-current" aria-current="page"' : ''}><td class="n">${i + 1}</td>`
      + `<td><a href="${prefix}${x.r.slug}/">${esc(x.r.name)}</a></td>`
      + `<td class="p">${pence(x.s.avg)}</td><td class="p">${pence(x.s.min)}</td><td class="t">${win}</td></tr>`;
  }).join('\n');
  return `
  <section class="card compare" aria-labelledby="compare-h">
    <h2 id="compare-h">Agile prices across Great Britain, ${esc(fmtShort.format(slotStart(day, 0)))}</h2>
    <p class="lead">Ranked by the day's average price, cheapest first. The average across all 14 regions is ${pence(gbAvg)} per kWh. Prices differ by region because each one has its own network charges.</p>
    <div class="table-scroll">
      <table>
        <thead><tr><th class="n">#</th><th>Region</th><th class="p">Average</th><th class="p">Lowest</th><th>Cheapest 2 hours</th></tr></thead>
        <tbody>
${body}
        </tbody>
      </table>
    </div>
  </section>`;
}

function regionSections(dataset, dayKey, PR, k, history) {
  const r = PR.REGIONS[k];
  const day = dataset.days[dayKey];
  const s = day.regions[k]?.summary;
  const ranked = Object.keys(PR.REGIONS).filter((x) => day.regions[x]?.summary)
    .sort((a, b) => day.regions[a].summary.avg - day.regions[b].summary.avg);
  const rank = ranked.indexOf(k) + 1;
  const gbAvg = ranked.reduce((a, x) => a + day.regions[x].summary.avg, 0) / ranked.length;

  const main = Object.entries(PR.AREAS).filter(([, v]) => v[0] === k).map(([a]) => a).sort();
  const partly = Object.entries(PR.AREAS).filter(([, v]) => v.slice(1).includes(k)).map(([a]) => a).sort();

  const histRows = history.map((h) => ({ date: h.date, st: h.regions[k] ? dayStats(h.regions[k]) : null, start: h.start }))
    .filter((h) => h.st);
  const recent = histRows.slice(0, 7);
  const negTotal = histRows.reduce((a, h) => a + h.st.negatives, 0);
  const since = histRows.length ? fmtLong.format(new Date(Date.parse(histRows[histRows.length - 1].start))) : null;

  const tKey = addDays(dayKey, 1);
  const tDay = dataset.days[tKey];
  const tS = tDay?.regions[k]?.summary;
  const tomorrowLine = tS?.cheapest2h
    ? ` Tomorrow (${esc(fmtShort.format(slotStart(tDay, 0)))}), the cheapest 2 hours are <b>${range(tDay, tS.cheapest2h.start, tS.cheapest2h.end)}</b> at ${pence(tS.cheapest2h.avg)} per kWh${tS.negatives.length ? ', with prices going below zero' : ''}.`
    : '';
  const rankLine = s
    ? `On ${esc(fmtLong.format(slotStart(day, 0)))}, ${esc(r.inName)} ranks <b>${ordinal(rank)} cheapest of ${ranked.length}</b> regions, averaging ${pence(s.avg)} per kWh against a Great Britain average of ${pence(gbAvg)}.${tomorrowLine}`
    : '';

  const histTable = recent.length ? `
    <div class="table-scroll">
      <table>
        <thead><tr><th>Day</th><th class="p">Average</th><th class="p">Lowest</th><th class="p">Below-zero half-hours</th></tr></thead>
        <tbody>
${recent.map((h) => `<tr><td>${esc(fmtShort.format(new Date(Date.parse(h.start))))}</td><td class="p">${pence(h.st.avg)}</td><td class="p">${pence(h.st.min)}</td><td class="p">${h.st.negatives}</td></tr>`).join('\n')}
        </tbody>
      </table>
    </div>
    <p class="hint">${negTotal > 0
      ? `Since ${esc(since)}, prices in ${esc(r.inName)} have gone below zero for ${negTotal} half-hour${negTotal === 1 ? '' : 's'}.`
      : `We've tracked ${esc(r.inName)} since ${esc(since)}. This table grows by a day every day.`}</p>` : '';

  const faqs = [
    [`When are tomorrow's Agile prices for ${r.inName} published?`,
      `Octopus publishes the next day's Agile prices at around 4pm UK time. Plunge Radar checks every hour from 4pm and updates this page as soon as they're out.`],
    [`Why are Agile prices different in ${r.inName}?`,
      `Agile prices follow the wholesale electricity market, plus network charges that vary across Great Britain's 14 electricity regions. ${s ? `Today ${r.inName} averages ${pence(s.avg)} per kWh, ${ordinal(rank)} cheapest of ${ranked.length}.` : ''}`.trim()],
    [`How do I know I'm in the ${r.name} region?`,
      `Look at the MPAN on your electricity bill. If its 13-digit number starts with ${r.mpan}, you're in ${r.name} (region ${k}). You can also enter your postcode in the checker at the top of this page.`],
    [`Can Agile prices go below zero in ${r.inName}?`,
      `Yes. When wind and solar produce more electricity than the grid needs, prices can drop below zero, and Agile customers are paid for the electricity they use.${negTotal > 0 ? ` Since ${since}, that's happened for ${negTotal} half-hour${negTotal === 1 ? '' : 's'} in ${r.inName}.` : ''}`],
    ['Do I need a smart meter for Agile Octopus?',
      'Yes. Agile needs a smart meter that sends half-hourly readings to Octopus. If you don\'t have one, Octopus can fit one at no extra cost.'],
  ];

  const local = `
  <section class="card local" aria-labelledby="local-h">
    <h2 id="local-h">Electricity in ${esc(r.inName)}</h2>
    ${rankLine ? `<p class="lead">${rankLine}</p>` : ''}
    <dl class="factlist">
      <div><dt>Covers</dt><dd>${esc(r.places)}</dd></div>
      <div><dt>Postcode areas</dt><dd>${main.join(', ')}${partly.length ? `; also parts of ${partly.join(', ')}` : ''}</dd></div>
      <div><dt>Region letter</dt><dd>${k}</dd></div>
      <div><dt>MPAN starts with</dt><dd>${r.mpan}</dd></div>
      <div><dt>Network operator</dt><dd>${esc(r.operator)}</dd></div>
    </dl>
    ${recent.length ? `<h3>Recent days in ${esc(r.inName)}</h3>${histTable}` : ''}
  </section>`;

  const faq = `
  <section class="faq" aria-labelledby="faq-h">
    <h2 id="faq-h">Agile Octopus in ${esc(r.inName)}: common questions</h2>
${faqs.map(([q, a]) => `    <details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n')}
  </section>`;
  return { local, faq, faqs, rank, total: ranked.length };
}

/** Write today's headline numbers into the page so they show without JavaScript. */
function prerender(html, day, s, label) {
  if (!s) return html;
  const set = (id, text) => {
    html = html.replace(new RegExp(`(id="${id}">)[^<]*(<)`), `$1${esc(text)}$2`);
  };
  if (s.cheapest2h) {
    set('best-time', range(day, s.cheapest2h.start, s.cheapest2h.end));
    set('best-price', `averages ${pence(s.cheapest2h.avg)} per kWh. Run the washing machine, dishwasher or car charger now.`);
  }
  if (s.priciest2h) {
    set('worst-time', range(day, s.priciest2h.start, s.priciest2h.end));
    set('worst-price', `averages ${pence(s.priciest2h.avg)} per kWh. Avoid big appliances if you can.`);
  }
  set('avg', pence(s.avg));
  set('min', `${pence(s.min)} at ${fmtTime.format(slotStart(day, s.minAt))}`);
  set('max', `${pence(s.max)} at ${fmtTime.format(slotStart(day, s.maxAt))}`);
  set('daylabel', label);
  return html;
}

function setResultsHeading(html, inName) {
  return html.replace(/(id="results-h">)[^<]*(<)/, `$1Cheapest times to use electricity in ${esc(inName)} today$2`);
}

function setMeta(html, { title, description, url }) {
  const rep = (re, val) => { html = html.replace(re, (m, a, b) => a + esc(val) + b); };
  rep(/(<title>)[^<]*(<\/title>)/, title);
  rep(/(<meta name="description" content=")[^"]*(">)/, description);
  rep(/(<meta property="og:title" content=")[^"]*(">)/, title);
  rep(/(<meta property="og:description" content=")[^"]*(">)/, description);
  rep(/(<meta name="twitter:title" content=")[^"]*(">)/, title);
  rep(/(<meta name="twitter:description" content=")[^"]*(">)/, description);
  rep(/(<link rel="canonical" href=")[^"]*(">)/, url);
  rep(/(<meta property="og:url" content=")[^"]*(">)/, url);
  return html;
}

// ---- Build ------------------------------------------------------------------

export async function build({
  siteDir = join(ROOT, 'site'),
  outDir = join(ROOT, '_site'),
  siteUrl = process.env.SITE_URL || 'https://plungeradar.co.uk',
  now = process.env.PLUNGE_NOW ? new Date(process.env.PLUNGE_NOW) : new Date(),
  log = console.log,
} = {}) {
  await rm(outDir, { recursive: true, force: true });
  await cp(siteDir, outDir, { recursive: true });

  const PR = await loadRegions(siteDir);
  const historyDays = await writeCalculatorHistory(siteDir, outDir, PR);
  log(`Calculator history: ${historyDays} day(s) since the price cap period began.`);
  const dataset = await readJSON(join(siteDir, 'data', 'latest.json'));
  const template = await readFile(join(siteDir, 'index.html'), 'utf8');
  const history = await loadHistory(siteDir);
  const base = siteUrl.replace(/\/$/, '');
  const pages = [{ loc: `${base}/` }];

  const today = londonDateString(now);
  const dayKey = dataset?.days?.[today] ? today : dataset ? Object.keys(dataset.days || {}).sort().reverse()[0] : null;
  const day = dayKey ? dataset.days[dayKey] : null;
  const lastmod = (dataset?.generatedAt || now.toISOString()).slice(0, 10);

  // Home page: add the GB table and pre-render London's numbers for crawlers.
  let home = template;
  if (day) {
    home = home.replace('<!--build:compare-->', compareSection(dataset, dayKey, PR, '', null));
    const cS = day.regions[PR.REGIONS.C ? 'C' : Object.keys(day.regions)[0]]?.summary;
    home = prerender(home, day, cS, `${PR.REGIONS.C.name} · ${fmtShort.format(slotStart(day, 0))}`);
    home = setResultsHeading(home, PR.REGIONS.C.inName);
  }
  await writeFile(join(outDir, 'index.html'), home);

  for (const k of Object.keys(PR.REGIONS)) {
    const r = PR.REGIONS[k];
    const url = `${base}/${r.slug}/`;
    const s = day?.regions[k]?.summary;
    const dateLabel = day ? fmtShort.format(slotStart(day, 0)) : '';
    const win = s?.cheapest2h ? range(day, s.cheapest2h.start, s.cheapest2h.end) : null;

    let html = template;
    // Assets sit one folder up.
    html = html.replace(/(href|src)="(styles\.css|manifest\.webmanifest|config\.js|regions\.js|app\.js|icons\/[^"]+)"/g, '$1="../$2"');

    // Google shows about 60 characters of a title and 155 of a description.
    const place = r.inName.replace(/^the /, '');
    const titleBase = `Agile Octopus Prices Today: ${place}`;
    const title = `${titleBase} | Plunge Radar`.length <= 60 ? `${titleBase} | Plunge Radar` : titleBase;
    const descOptions = win
      ? [
          `${win} is the cheapest time for electricity in ${r.inName} on ${dateLabel} (${pence(s.cheapest2h.avg)}/kWh). Half-hourly Agile Octopus prices for today and tomorrow.`,
          `${win} is the cheapest time in ${r.inName} on ${dateLabel} (${pence(s.cheapest2h.avg)}/kWh). Agile Octopus prices for today and tomorrow.`,
          `${win} is the cheapest time in ${r.inName} on ${dateLabel} (${pence(s.cheapest2h.avg)}/kWh).`,
        ]
      : [`Today's and tomorrow's half-hourly Agile Octopus prices for ${r.inName}, with the cheapest times to use electricity.`];
    const description = descOptions.find((d) => d.length <= 155) || descOptions[descOptions.length - 1];
    html = setMeta(html, { title, description, url });

    html = html.replace(/(<h1>)[^<]*(<\/h1>)/, `$1Agile Octopus tariff prices today in ${esc(r.inName)}$2`);
    html = html.replace(/(<p class="hero-lede">)[^<]*(<\/p>)/,
      `$1Agile Octopus is a smart electricity tariff from Octopus Energy where the price changes every half-hour. Here are today's and tomorrow's prices for ${esc(r.inName)} (region ${k}), with the cheapest times to use power.$2`);

    let extra = { local: '', faq: '', faqs: [] };
    if (day) {
      extra = regionSections(dataset, dayKey, PR, k, history);
      html = html.replace('<!--build:compare-->', extra.local + compareSection(dataset, dayKey, PR, '../', k) + extra.faq);
      html = prerender(html, day, s, `${r.name} · ${dateLabel}`);
      html = setResultsHeading(html, r.inName);
    }

    const ld = [
      {
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Plunge Radar', item: `${base}/` },
          { '@type': 'ListItem', position: 2, name: `Agile prices in ${sentenceCase(r.inName)}`, item: url },
        ],
      },
      {
        '@context': 'https://schema.org', '@type': 'WebPage', name: title, url, description,
        dateModified: dataset?.generatedAt || now.toISOString(), inLanguage: 'en-GB',
      },
    ];
    if (extra.faqs.length) {
      ld.push({
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: extra.faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
      });
    }
    html = html.replace(/<script type="application\/ld\+json" id="ld-home">[\s\S]*?<\/script>\n?/, '');
    html = html.replace('</head>', `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>\n</head>`);
    html = html.replace('<script src="../config.js"></script>',
      `<script>window.PLUNGE_PAGE = { region: "${k}", base: "../" };</script>\n<script src="../config.js"></script>`);

    await mkdir(join(outDir, r.slug), { recursive: true });
    await writeFile(join(outDir, r.slug, 'index.html'), html);
    pages.push({ loc: url });
  }

  // Disclaimer and terms of use.
  await mkdir(join(outDir, 'disclaimer'), { recursive: true });
  await writeFile(join(outDir, 'disclaimer', 'index.html'), disclaimerPage({ base }));
  pages.push({ loc: `${base}/disclaimer/` });

  // Friendly 404: GitHub Pages serves this for any missing address, so links are absolute.
  const links = Object.values(PR.REGIONS).map((r) => `<li><a href="/${r.slug}/">${esc(r.name)}</a></li>`).join('');
  await writeFile(join(outDir, '404.html'), `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Page not found | Plunge Radar</title><meta name="robots" content="noindex">
<link rel="icon" href="/icons/icon.svg" type="image/svg+xml"><link rel="stylesheet" href="/styles.css"></head>
<body><main class="wrap" style="padding-block:48px">
<h1 style="font:900 2rem/1.1 var(--font-display);margin:0">Page not found</h1>
<p class="lead">That page doesn't exist. Today's Agile Octopus prices are on the <a href="/">home page</a>, or pick your region:</p>
<ul class="region-links">${links}</ul>
</main></body></html>
`);

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url><loc>${p.loc}</loc><lastmod>${lastmod}</lastmod><changefreq>daily</changefreq></url>`).join('\n')}
</urlset>
`;
  await writeFile(join(outDir, 'sitemap.xml'), sitemap);
  log(`Built ${pages.length} pages into ${outDir}${day ? ` using prices for ${dayKey}` : ' (no price data yet)'}`);
  return { pages: pages.map((p) => p.loc), dayKey };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  build().catch((err) => { console.error(`Build failed: ${err.message}`); process.exit(1); });
}
