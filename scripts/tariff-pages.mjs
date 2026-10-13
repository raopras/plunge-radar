// The /octopus-tariffs/ section: a hub ("Which Octopus Energy tariff suits you?")
// and one page per tariff. Purpose: help people choose an Octopus Energy tariff
// and join through the referral link. Every page carries the referral disclosure
// and the independence note next to its switch buttons.
//
// Numbers are written into the HTML for London (region C) so search engines and
// visitors without JavaScript see real figures; site/tariffs.js swaps them for the
// visitor's region using the small summary embedded in each page.

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { emailLink } from './legal.mjs';

const TZ = 'Europe/London';
const fmtShort = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' });
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const p1 = (p) => (p === null || p === undefined || Number.isNaN(p) ? '–' : (p < 0 ? '−' : '') + Math.abs(p).toFixed(1) + 'p');
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const dayLabel = (d) => fmtShort.format(new Date(`${d}T12:00:00Z`));

export const SECTION = 'octopus-tariffs';
const DEFAULT_REGION = 'C';

// ---- Numbers ---------------------------------------------------------------

/**
 * One row of display-ready figures per region. Missing data shows as "–" and the
 * sentence around it still reads correctly.
 */
export function tariffSummary({ tariffs, dataset, history, today, PR }) {
  const out = {};
  const agileDay = dataset?.days?.[today] ? today : Object.keys(dataset?.days || {}).filter((d) => d <= today).sort().pop();
  for (const k of Object.keys(PR.REGIONS)) {
    const t = tariffs?.regions?.[k] || {};
    const prices = (agileDay && dataset.days[agileDay].regions[k]?.prices) || [];
    const known = prices.filter((x) => x !== null);
    const agileDays = history.map((h) => (h.regions[k] || []).filter((x) => x !== null)).filter((x) => x.length).map(mean);
    const rates = (t.tracker?.rates || []).filter((r) => r.d <= today);
    const trToday = rates.find((r) => r.d === today);
    const trTomorrow = (t.tracker?.rates || []).find((r) => r.d > today);
    out[k] = {
      region: PR.REGIONS[k].name,
      inRegion: `in ${PR.REGIONS[k].inName}`,
      agileToday: p1(mean(known)),
      agileLow: p1(known.length ? Math.min(...known) : null),
      agileHigh: p1(known.length ? Math.max(...known) : null),
      agileAvg30: p1(mean(agileDays)),
      agileStanding: p1(t.agile?.standing),
      goNight: p1(t.go?.night),
      goDay: p1(t.go?.day),
      goStanding: p1(t.go?.standing),
      trackerToday: p1(trToday?.p ?? rates[0]?.p),
      trackerTomorrow: trTomorrow ? p1(trTomorrow.p) : '',
      trackerAvg30: p1(mean(rates.slice(0, 30).map((r) => r.p))),
      trackerLow30: p1(rates.length ? Math.min(...rates.slice(0, 30).map((r) => r.p)) : null),
      trackerHigh30: p1(rates.length ? Math.max(...rates.slice(0, 30).map((r) => r.p)) : null),
      trackerStanding: p1(t.tracker?.standing),
      flexUnit: p1(t.flexible?.unit),
      flexStanding: p1(t.flexible?.standing),
    };
  }
  return {
    regions: out,
    agileDate: agileDay ? dayLabel(agileDay) : '',
    agileDays: history.length,
    trackerDate: today ? dayLabel(today) : '',
  };
}

// A value that tariffs.js updates when the visitor picks a region.
const v = (S, k, key) => `<span data-v="${key}">${esc(S.regions[k][key])}</span>`;

// ---- Shared pieces -----------------------------------------------------------

function head({ base, path, title, description, ld }) {
  const url = `${base}/${path}`;
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:locale" content="en_GB">
<meta property="og:site_name" content="Plunge Radar">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${base}/og-image.png">
<meta property="og:image:alt" content="Plunge Radar: compare Octopus Energy tariffs for your region">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="theme-color" content="#0E1A2E">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@700;800;900&family=IBM+Plex+Mono:wght@500;700&family=Public+Sans:wght@400;600;700&display=swap">
<link rel="stylesheet" href="/styles.css">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
</head>
<body class="tariff-page">`;
}

function brand(crumbs) {
  return `
    <a class="brandline brand-link" href="/">
      <svg class="mark" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="var(--cta)"/><path d="M5 12h4l3 10 4-16 4 13 2-5h5" fill="none" stroke="var(--cta-ink)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span class="wordmark">Plunge Radar</span>
    </a>
    <nav class="crumbs" aria-label="Breadcrumb"><ol>${crumbs.map(([name, href]) => (href ? `<li><a href="${href}">${esc(name)}</a></li>` : `<li aria-current="page">${esc(name)}</li>`)).join('')}</ol></nav>`;
}

// The main switch button. Every one sits next to the referral disclosure.
function cta(id, label, { big = false, small = false } = {}) {
  return `<a data-cta="${id}" class="btn-cta${big ? ' big' : ''}${small ? ' small' : ''} ref-link" href="{{REF}}" rel="sponsored noopener" target="_blank">${label}</a>`;
}
const heroFine = '<p class="fine">Referral link: you and we each get <span class="reward">£50</span> credit once you\'re on supply and your first Direct Debit is paid. Plunge Radar is independent of Octopus Energy.</p>';

function regionPicker(PR, k) {
  const opts = Object.entries(PR.REGIONS).map(([key, r]) => `<option value="${key}"${key === k ? ' selected' : ''}>${esc(r.name)}</option>`).join('');
  return `
  <div class="card t-region">
    <label for="t-region">Show rates for</label>
    <select id="t-region">${opts}</select>
    <p class="hint">Not sure? <a href="/">Check your region with your postcode</a>.</p>
  </div>`;
}

function switchSection(name, step2, ref) {
  return `
  <section class="switch ref-only" id="switch" aria-labelledby="switch-h">
    <h2 id="switch-h">How to switch to ${esc(name)}</h2>
    <ol class="steps">
      <li><div><b>Join Octopus Energy with our link.</b> Choose Flexible Octopus when you sign up: it has no exit fees. You get <span class="reward">£50</span> credit once you're on supply and your first Direct Debit is paid, which Octopus Energy says typically takes around four weeks.</div></li>
      <li><div>${step2}</div></li>
    </ol>
    ${cta('steps', `Join Octopus Energy <span class="badge"><span class="reward">£50</span> credit</span>`, { big: true })}
    <p class="fine-dark">This is a referral link: we also get <span class="reward">£50</span>, which keeps this site free. Plunge Radar is independent and not affiliated with Octopus Energy.</p>
    <div class="copylink">
      <p class="copylink-h">Switching later, or on another device?</p>
      <div class="copylink-row">
        <input id="ref-url" type="text" readonly value="${esc(ref)}" aria-label="Our Octopus Energy referral link">
        <button type="button" class="btn-secondary" id="ref-copy">Copy link</button>
      </div>
      <p class="fine-dark" id="ref-copy-msg" role="status" aria-live="polite">Paste it into your browser when you're ready to join. It's the same referral link as the buttons above.</p>
    </div>
  </section>`;
}

function faqSection(id, title, faqs) {
  return `
  <section class="faq" aria-labelledby="${id}">
    <h2 id="${id}">${esc(title)}</h2>
${faqs.map(([q, a]) => `    <details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n')}
  </section>`;
}

const SHARED_FAQS = [
  ['Do I have to be an Octopus Energy customer first?',
    'Yes. Agile Octopus, Intelligent Octopus Go and Octopus Tracker are only open to Octopus Energy customers. Join Octopus Energy first, usually on Flexible Octopus, then change tariff in your online account or app once your supply has moved over.'],
  ['How does the £50 referral credit work?',
    'When you join Octopus Energy through a referral link, you and the person who referred you each get £50 account credit. Octopus Energy pays it once you are on supply and your first Direct Debit has been taken, which usually takes about four weeks. Octopus Energy sets the terms and can change them.'],
  ['I joined Octopus Energy without a link. Can I still get the credit?',
    'Octopus Energy says that if you joined directly on its website and forgot to use a referral link, you can contact them with the referral code. Ours is silk-snail-210. Sign-ups through comparison sites don\'t qualify.'],
];

function otherTariffs(currentSlug) {
  const items = PAGES.filter((p) => p.slug !== currentSlug)
    .map((p) => `<li><a href="/${SECTION}/${p.slug}/"><b>${esc(p.name)}</b><span>${esc(p.oneLine)}</span></a></li>`).join('');
  return `
  <section class="others" aria-labelledby="others-h">
    <h2 id="others-h">Compare other Octopus Energy tariffs</h2>
    <ul class="tariff-cards">${items}</ul>
    <p class="hint"><a href="/${SECTION}/">Take the 4-question quiz to see which tariff suits you</a>.</p>
  </section>`;
}

function footer(cap) {
  return `
  <footer class="small">
    <nav class="foot-nav" aria-label="More from Plunge Radar"><a href="/">Today's Agile prices</a> · <a href="/${SECTION}/">Compare Octopus tariffs</a> · <a href="/disclaimer/">Disclaimer</a></nav>
    <p>Plunge Radar is independent and not affiliated with Octopus Energy. Links marked as referral links earn us account credit if you switch through them.</p>
    <p>Rates come from the public Octopus Energy API, for paying by monthly Direct Debit, and include any VAT due. There is no VAT on electricity from 1 October 2026 to 31 March 2027. ${cap ? `The price cap figure is Ofgem's Great Britain average for ${esc(cap.label)}; the cap in your region may differ slightly.` : ''}</p>
    <p><b>Information only, not advice.</b> Tariffs change, so check the current rates and terms with Octopus Energy before you switch, and decide for yourself which tariff suits your home. <a href="/disclaimer/">Read the full disclaimer</a>.</p>
    <p id="analytics-note" hidden>We count page visits and button clicks anonymously, without cookies, to see what helps visitors.</p>
    <p>Contact: ${emailLink()}</p>
    <p>Postal address: c/o SoloStarterHQ, 80A Ruskin Ave, Welling, London DA16 3QQ, United Kingdom.</p>
    <p>&copy; 2026 Pras Rao. All rights reserved.</p>
  </footer>`;
}

function tail(S, page) {
  return `
</main>

<div class="stickybar ref-only" id="stickybar" hidden>
  <span class="sb-text"><b><span class="reward">£50</span> credit</b> when you join Octopus Energy</span>
  <a data-cta="sticky" class="btn-cta small ref-link" href="{{REF}}" rel="sponsored noopener" target="_blank">Join now</a>
  <button type="button" class="sb-close" id="sb-close" aria-label="Hide this bar">×</button>
</div>

<script>window.TARIFF_PAGE = ${JSON.stringify({ page, data: S.regions }).replace(/</g, '\\u003c')};</script>
<script src="/config.js"></script>
<script src="/tariffs.js"></script>
</body>
</html>
`;
}

// ---- The four tariffs --------------------------------------------------------

export const PAGES = [
  {
    slug: 'agile', name: 'Agile Octopus', short: 'Agile',
    oneLine: 'Price changes every half-hour. Best if you can use power at cheap times.',
    title: 'Agile Octopus Tariff: Who It Suits and How to Switch',
    description: 'Agile Octopus explained: half-hourly prices, today\'s rates for your region, who it suits, who it doesn\'t, and how to switch with £50 credit.',
    h1: 'Agile Octopus: is the half-hourly tariff right for you?',
    lede: 'Agile Octopus is an electricity tariff from Octopus Energy where the price changes every half-hour, following the wholesale market. It rewards homes that can use electricity at cheap times.',
    glance: (S, k, cap) => [
      ['How the price works', 'A new price for every half-hour, published the day before'],
      ['Today in your region', `Average ${v(S, k, 'agileToday')}, from ${v(S, k, 'agileLow')} to ${v(S, k, 'agileHigh')} per kWh`],
      [`Average over the last ${S.agileDays || 30} days`, `${v(S, k, 'agileAvg30')} per kWh${cap ? ` (price cap: ${p1(cap.unitRate)})` : ''}`],
      ['Standing charge', `${v(S, k, 'agileStanding')} a day`],
      ['Price limit', 'Never more than 100p per kWh'],
      ['Exit fee', 'None'],
      ['You need', 'A smart meter that sends half-hourly readings'],
    ],
    how: [
      'Octopus Energy sets a price for each half-hour of the next day from wholesale prices, and publishes it between 4pm and 8pm, usually nearer 4pm.',
      'Prices are usually lowest overnight and when it\'s windy or sunny, and highest from 4pm to 7pm. When the grid has more power than it needs, the price can drop below zero, and you are paid for the electricity you use. Octopus Energy calls this plunge pricing.',
      'Octopus Energy says Agile suits customers who can shift large amounts of their use away from the expensive peaks, usually between 4pm and 7pm, often with smart tech such as batteries or solar. Prices can spike up to 100p per kWh at any time.',
      'Octopus Energy\'s Agile page also says that when wholesale prices are high, you\'re likely to save more on a standard variable or fixed tariff through the winter. Check the recent prices on Plunge Radar before you decide.',
    ],
    suits: ['You can shift a large share of your use away from the 4pm to 7pm peak', 'You have an electric car, home battery, solar panels or storage heaters you can schedule', 'You\'re happy to check prices each afternoon, or use apps and timers that do it for you'],
    notFor: ['Most of your use falls between 4pm and 7pm', 'You need predictable bills', 'You rely on electricity for medical equipment or essential heating at peak times'],
    step2: '<b>Sign up for Agile Octopus.</b> Once you\'re a customer, Octopus Energy needs to connect to your smart meter (usually around 14 days), then emails you to accept the Agile terms and your tariff changes. Then use <a href="/">Plunge Radar</a> each afternoon to plan around tomorrow\'s prices.',
    faqs: (S, k) => [
      ['Can Agile Octopus cost more than a standard tariff?', 'Yes. Octopus Energy says Agile prices can spike up to 100p per kWh at any time, are usually most expensive between 4pm and 7pm, and that when wholesale prices are high you\'re likely to save more on a standard variable or fixed tariff through the winter. It suits homes that can shift a lot of their use away from the peaks.'],
      ['When are Agile prices published?', 'Octopus Energy publishes the next day\'s half-hourly prices between 4pm and 8pm, usually nearer 4pm. Plunge Radar shows them for your region as soon as they\'re out.'],
      ['What is the most Agile Octopus can charge?', 'Octopus Energy caps Agile prices at 100p per kWh, including any VAT due.'],
      [`What do Agile prices look like ${S.regions[k].inRegion}?`, `Today Agile averages ${S.regions[k].agileToday} per kWh ${S.regions[k].inRegion}, and ${S.regions[k].agileAvg30} on average over the last ${S.agileDays || 30} days. See every half-hour on the Plunge Radar home page.`],
    ],
  },
  {
    slug: 'intelligent-octopus-go', name: 'Intelligent Octopus Go', short: 'Intelligent Go',
    oneLine: 'Cheap overnight electricity and smart charging for electric car owners.',
    title: 'Intelligent Octopus Go: EV Tariff Rates and Switching',
    description: 'Intelligent Octopus Go explained: overnight EV rate, day rate and standing charge for your region, the car and charger you need, and how to switch.',
    h1: 'Intelligent Octopus Go: the electric car tariff explained',
    lede: 'Intelligent Octopus Go is an electricity tariff from Octopus Energy for electric car owners. You get six hours of cheap electricity every night, and Octopus Energy schedules your car\'s charging at the cheapest times.',
    glance: (S, k) => [
      ['How the price works', 'Two fixed rates: a cheap overnight rate and a day rate'],
      ['Cheap rate, 11:30pm to 5:30am', `${v(S, k, 'goNight')} per kWh for the whole home`],
      ['Other times', `${v(S, k, 'goDay')} per kWh`],
      ['Standing charge', `${v(S, k, 'goStanding')} a day`],
      ['Contract', 'Fixed for 12 months, £50 exit fee'],
      ['You need', 'A supported electric car or charger, a smart meter sending half-hourly readings, and an iPhone or Android phone for the Octopus app'],
    ],
    how: [
      'Every night from 11:30pm to 5:30am, all the electricity your home uses is charged at the cheap rate.',
      'When you plug in, you tell the Octopus app how much charge you need and by when. Octopus Energy schedules the charging when energy is expected to be cheaper. Your first 6 hours of smart charging each day are billed at the cheap rate, whenever they happen.',
      'The day rate is well above the price cap rate, so the tariff pays off when a big share of your use, usually the car, happens in the cheap hours. Charging straight away with a "bump charge", or any charging Octopus Energy hasn\'t scheduled, is billed at the day rate.',
    ],
    suits: ['You charge an electric car at home most nights', 'Your car or charger is on Octopus Energy\'s supported list', 'You can run other big appliances overnight too'],
    notFor: ['You don\'t have an electric car, or charge mostly away from home (it only works for home charging)', 'Your car and charger aren\'t supported (Octopus Energy suggests its Octopus Go tariff instead)', 'Most of your home\'s use is during the day, at the higher day rate'],
    step2: '<b>Sign up for Intelligent Octopus Go.</b> First check that your car or charger is supported on Octopus Energy\'s Intelligent Octopus Go page. Once you\'re on supply and your smart meter is sending half-hourly readings, sign up and connect your car or charger in the Octopus app.',
    faqs: (S, k) => [
      ['Which cars and chargers work with Intelligent Octopus Go?', 'Octopus Energy says it works with over 280 cars and selected chargers. You can check yours on its Intelligent Octopus Go page before you switch.'],
      ['Is there an exit fee?', 'Yes. Intelligent Octopus Go is fixed for 12 months and has a £50 exit fee if you change tariff or supplier early.'],
      ['Do I get the cheap rate for the whole house?', 'Yes, from 11:30pm to 5:30am every night. On top of that, your first 6 hours of smart charging each day are billed at the cheap rate, even if Octopus Energy schedules them outside those hours.'],
      [`What are the rates ${S.regions[k].inRegion}?`, `The cheap rate is ${S.regions[k].goNight} per kWh, the day rate is ${S.regions[k].goDay} per kWh and the standing charge is ${S.regions[k].goStanding} a day, for Direct Debit customers.`],
    ],
  },
  {
    slug: 'tracker', name: 'Octopus Tracker', short: 'Tracker',
    oneLine: 'One price a day that follows the wholesale market. Use less on pricey days.',
    title: 'Octopus Tracker Tariff: Daily Prices and Who It Suits',
    description: 'Octopus Tracker explained: one electricity price a day linked to wholesale costs, today\'s rate for your region, the risks in winter, and how to switch.',
    h1: 'Octopus Tracker: one electricity price a day, set by the market',
    lede: 'Octopus Tracker is an electricity tariff from Octopus Energy with one unit price for each day, set from an independently published wholesale market price. You don\'t have to plan around half-hours, but it pays to use less on pricey days.',
    glance: (S, k, cap) => [
      ['How the price works', 'A new price every day, from a published formula'],
      [`Today (${S.trackerDate})`, `${v(S, k, 'trackerToday')} per kWh`],
      ['Last 30 days', `Average ${v(S, k, 'trackerAvg30')}, from ${v(S, k, 'trackerLow30')} to ${v(S, k, 'trackerHigh30')}${cap ? ` (price cap: ${p1(cap.unitRate)})` : ''}`],
      ['Standing charge', `${v(S, k, 'trackerStanding')} a day`],
      ['Price limit', 'Never more than 100p per kWh'],
      ['Contract', '12 months, no exit fee (if you leave early, you wait 9 months to rejoin)'],
      ['You need', 'A smart meter that Octopus Energy can read'],
    ],
    how: [
      'Each day\'s price is worked out from the previous day\'s wholesale electricity price, using a formula Octopus Energy publishes for each region. For people joining since 1 April 2026, it is the wholesale price multiplied by a regional factor, plus a fixed amount for network and other costs.',
      'Octopus Energy says prices tend to be lower in warmer months, then typically increase, likely double, in colder months. Over a winter, Tracker can cost more than the price cap.',
      'The formula and standing charge are fixed for 12 months. You can leave at any time with no exit fee, but if you leave during those 12 months you have to wait 9 months to rejoin.',
    ],
    suits: ['You can use energy flexibly: less on pricey days, more on cheap ones', 'You don\'t mind feeling the market\'s peaks and troughs first', 'You\'d like a simple daily price rather than a half-hourly one'],
    notFor: ['You need predictable bills, especially in winter', 'You can shift a lot of your use to cheap times (Agile may suit you better)', 'You\'d struggle if prices rose sharply for weeks'],
    step2: '<b>Sign up for Octopus Tracker.</b> Once you\'re a customer, Octopus Energy needs to connect to your smart meter (usually around 14 days), then emails you to accept the Tracker terms and your tariff changes. This page covers Tracker for electricity only.',
    faqs: (S, k) => [
      ['How is the Octopus Tracker price set?', 'Each day\'s price comes from the previous day\'s wholesale electricity price, multiplied by a regional factor, plus a fixed amount for non-wholesale costs. Octopus Energy publishes the formula for each region in its Tracker FAQs.'],
      ['Can Octopus Tracker cost more than the price cap?', 'Yes. Octopus Energy says prices typically increase, likely double, in colder months, and the daily price is capped at 100p per kWh, a lot higher than the price cap. Octopus Energy says that if you can\'t afford prices to go that high, you\'re probably better off on a protected tariff such as Flexible Octopus.'],
      ['Is there an exit fee?', 'No. You can leave Octopus Tracker at any time without a fee. If you leave within the 12-month term, you can\'t rejoin for 9 months.'],
      [`What is the Tracker price ${S.regions[k].inRegion} today?`, `Today it is ${S.regions[k].trackerToday} per kWh ${S.regions[k].inRegion}, with an average of ${S.regions[k].trackerAvg30} over the last 30 days.`],
    ],
  },
  {
    slug: 'flexible', name: 'Flexible Octopus', short: 'Flexible',
    oneLine: 'A standard variable tariff with no exit fees. No smart meter needed.',
    title: 'Flexible Octopus Tariff: Rates, Exit Fees, Who It Suits',
    description: 'Flexible Octopus explained: the variable tariff\'s unit rate and standing charge for your region, how often it changes, no exit fees, and how to switch.',
    h1: 'Flexible Octopus: the simple variable tariff',
    lede: 'Flexible Octopus is Octopus Energy\'s standard variable electricity tariff. The price usually changes every three months, there are no exit fees, and you don\'t need a smart meter.',
    glance: (S, k, cap) => [
      ['How the price works', 'One unit rate that rises or falls every three months with wholesale energy'],
      ['Unit rate', `${v(S, k, 'flexUnit')} per kWh${cap ? ` (price cap: ${p1(cap.unitRate)})` : ''}`],
      ['Standing charge', `${v(S, k, 'flexStanding')} a day`],
      ['Exit fee', 'None'],
      ['You need', 'No smart meter needed'],
    ],
    how: [
      'You pay the same unit rate whatever the time of day. Octopus Energy says the price will rise or fall every three months with wholesale energy.',
      'Flexible Octopus is also the tariff most people join on. You can move to Agile Octopus, Intelligent Octopus Go or Octopus Tracker later from your account, once you have a smart meter.',
    ],
    suits: ['You want a simple tariff with no exit fees', 'You don\'t have a smart meter yet', 'You aren\'t sure yet and want to join Octopus Energy first, then choose a smart tariff'],
    notFor: ['You have an electric car (Intelligent Octopus Go is usually much cheaper overnight)', 'You can shift a lot of use to cheap times (Agile may cost less)', 'You want your price fixed for a year (look at Octopus Energy\'s fixed tariffs)'],
    step2: '<b>Choose Flexible Octopus when you sign up.</b> That\'s it. If you get a smart meter later, you can switch to a smart tariff from your account.',
    faqs: (S, k) => [
      ['Does Flexible Octopus have exit fees?', 'No. You can leave or change tariff at any time without a fee.'],
      ['How often does the Flexible Octopus price change?', 'Octopus Energy says Flexible Octopus prices rise or fall every three months with wholesale energy.'],
      ['Do I need a smart meter for Flexible Octopus?', 'No. Flexible Octopus works with any meter. You need a smart meter only if you want to move to a smart tariff such as Agile Octopus later.'],
      [`What are the Flexible Octopus rates ${S.regions[k].inRegion}?`, `The unit rate is ${S.regions[k].flexUnit} per kWh and the standing charge is ${S.regions[k].flexStanding} a day, for Direct Debit customers.`],
    ],
  },
];

// ---- Page builders -----------------------------------------------------------

function tariffPage({ p, S, k, base, cap, ref, PR }) {
  const path = `${SECTION}/${p.slug}/`;
  const url = `${base}/${path}`;
  const faqs = [...p.faqs(S, k), ...SHARED_FAQS];
  const ld = [
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Plunge Radar', item: `${base}/` },
      { '@type': 'ListItem', position: 2, name: 'Octopus Energy tariffs', item: `${base}/${SECTION}/` },
      { '@type': 'ListItem', position: 3, name: p.name, item: url },
    ] },
    { '@context': 'https://schema.org', '@type': 'WebPage', name: p.title, url, description: p.description, inLanguage: 'en-GB' },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ];
  const glance = p.glance(S, k, cap).map(([dt, dd]) => `<div><dt>${esc(dt)}</dt><dd>${dd}</dd></div>`).join('\n      ');
  return head({ base, path, title: p.title, description: p.description, ld }) + `
<header class="hero">
  <div class="hero-inner">${brand([['Plunge Radar', '/'], ['Octopus tariffs', `/${SECTION}/`], [p.name, null]])}
    <h1>${esc(p.h1)}</h1>
    <p class="hero-lede">${esc(p.lede)}</p>
    <div class="hero-cta ref-only">
      ${cta('hero', `Join Octopus Energy <span class="badge"><span class="reward">£50</span> credit</span>`)}
      ${heroFine}
    </div>
  </div>
</header>

<main class="wrap">
  ${regionPicker(PR, k)}

  <section class="card glance" aria-labelledby="glance-h">
    <h2 id="glance-h">${esc(p.name)} <span data-v="inRegion">${esc(S.regions[k].inRegion)}</span> at a glance</h2>
    <dl class="factlist">
      ${glance}
    </dl>
  </section>

  <section class="prose" aria-labelledby="how-h">
    <h2 id="how-h">How ${esc(p.name)} works</h2>
    ${p.how.map((t) => `<p>${esc(t)}</p>`).join('\n    ')}
  </section>

  <section class="fit" aria-label="Who ${esc(p.name)} suits">
    <div class="card fit-yes"><h2>It may suit you if</h2><ul>${p.suits.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>
    <div class="card fit-no"><h2>Think twice if</h2><ul>${p.notFor.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>
  </section>
${switchSection(p.name, p.step2, ref)}
${faqSection('faq-h', `${p.name}: common questions`, faqs)}
${otherTariffs(p.slug)}
${footer(cap)}` + tail(S, `tariff-${p.slug}`);
}

function hubPage({ S, k, base, cap, ref, PR }) {
  const path = `${SECTION}/`;
  const url = `${base}/${path}`;
  const title = 'Which Octopus Energy Tariff Suits You? | Plunge Radar';
  const description = 'Compare Agile Octopus, Intelligent Octopus Go, Octopus Tracker and Flexible Octopus: live rates for your region, a 4-question quiz, and how to switch.';
  const faqs = [
    ['Which Octopus Energy tariff is cheapest?', 'It depends on when you use electricity. For electric car owners, Octopus Energy says Intelligent Octopus Go customers typically saved £771 over May 2025 to April 2026 compared with Flexible Octopus. Agile Octopus suits homes that can shift a lot of use away from the 4pm to 7pm peak. Octopus Tracker suits homes that can use less on pricey days. Flexible Octopus is the simple option with no exit fees.'],
    ['Can I change Octopus Energy tariff later?', 'Yes. Once you\'re a customer you can change tariff in your account or app. Intelligent Octopus Go has a £50 exit fee if you leave within 12 months, and if you leave Octopus Tracker within its 12-month term you wait 9 months to rejoin.'],
    ...SHARED_FAQS,
  ];
  const ld = [
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Plunge Radar', item: `${base}/` },
      { '@type': 'ListItem', position: 2, name: 'Octopus Energy tariffs', item: url },
    ] },
    { '@context': 'https://schema.org', '@type': 'WebPage', name: title, url, description, inLanguage: 'en-GB' },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ];
  const q = (name, legend, options) => `
      <fieldset>
        <legend>${esc(legend)}</legend>
        <div class="q-opts">${options.map(([val, label]) => `<label><input type="radio" name="${name}" value="${val}"> <span>${esc(label)}</span></label>`).join('')}</div>
      </fieldset>`;
  const rows = [
    ['agile', 'Changes every half-hour', `Today ${v(S, k, 'agileToday')} average; ${v(S, k, 'agileAvg30')} over ${S.agileDays || 30} days`, v(S, k, 'agileStanding'), 'None', 'Smart meter'],
    ['intelligent-octopus-go', 'Two fixed rates for 12 months', `${v(S, k, 'goNight')} from 11:30pm to 5:30am; ${v(S, k, 'goDay')} other times`, v(S, k, 'goStanding'), '£50', 'Electric car, supported car or charger, smart meter'],
    ['tracker', 'Changes every day', `Today ${v(S, k, 'trackerToday')}; ${v(S, k, 'trackerAvg30')} over 30 days`, v(S, k, 'trackerStanding'), 'None', 'Smart meter'],
    ['flexible', 'Changes every 3 months', v(S, k, 'flexUnit'), v(S, k, 'flexStanding'), 'None', 'No smart meter needed'],
  ].map(([slug, how, unit, sc, fee, need]) => {
    const p = PAGES.find((x) => x.slug === slug);
    return `<tr><th scope="row"><a href="/${SECTION}/${slug}/">${esc(p.name)}</a></th><td data-label="Price"><span>${how}</span></td><td class="u" data-label="Unit rate"><span>${unit}</span></td><td class="p" data-label="Standing charge"><span>${sc}</span></td><td data-label="Exit fee"><span>${fee}</span></td><td data-label="You need"><span>${need}</span></td></tr>`;
  }).join('\n          ');
  return head({ base, path, title, description, ld }) + `
<header class="hero">
  <div class="hero-inner">${brand([['Plunge Radar', '/'], ['Octopus tariffs', null]])}
    <h1>Which Octopus Energy tariff suits you?</h1>
    <p class="hero-lede">Octopus Energy has four main electricity tariffs for homes: Agile Octopus, Intelligent Octopus Go, Octopus Tracker and Flexible Octopus. Answer four questions to see which tariff fits how you use electricity, then compare today's rates for your region.</p>
    <div class="hero-cta ref-only">
      ${cta('hero', `Join Octopus Energy <span class="badge"><span class="reward">£50</span> credit</span>`)}
      ${heroFine}
    </div>
  </div>
</header>

<main class="wrap">
  <section class="card quiz" id="quiz" aria-labelledby="quiz-h">
    <h2 id="quiz-h">Find your tariff in four questions</h2>
    <form id="quiz-form" novalidate>${q('ev', '1. Do you charge an electric car at home?', [['yes', 'Yes'], ['soon', 'Getting one soon'], ['no', 'No']])}${q('shift', '2. Could you use more electricity at cheap times, like overnight?', [['lot', 'Yes, a lot (car, battery, heat pump, timers)'], ['some', 'Some: washing, dishwasher'], ['none', 'Not really']])}${q('change', '3. How do you feel about prices that change?', [['ok', 'Fine, if it should cost less overall'], ['fixed', 'I\'d rather know what I\'ll pay']])}${q('meter', '4. Do you have a smart meter?', [['yes', 'Yes'], ['no', 'No'], ['unsure', 'Not sure']])}
      <button type="submit" class="btn-secondary quiz-go">Show my tariff</button>
      <p class="hint" id="quiz-msg" role="status" aria-live="polite"></p>
    </form>
    <div class="quiz-result" id="quiz-result" aria-live="polite" hidden>
      <p class="qr-k">Your best match</p>
      <p class="qr-name" id="qr-name"></p>
      <p class="qr-why" id="qr-why"></p>
      <p class="qr-note" id="qr-note" hidden></p>
      <div class="qr-actions ref-only">
        ${cta('quiz', `Join Octopus Energy <span class="badge"><span class="reward">£50</span> credit</span>`)}
        <a class="qr-more" id="qr-more" href="/${SECTION}/">Read about this tariff</a>
      </div>
      <p class="fine-quiz">Referral link: you and we each get <span class="reward">£50</span> credit. You join Octopus Energy first, then choose this tariff in your account. This is a guide, not advice.</p>
    </div>
  </section>

  ${regionPicker(PR, k)}

  <section class="card compare tariffs-table" aria-labelledby="cmp-h">
    <h2 id="cmp-h">Octopus Energy tariffs compared <span data-v="inRegion">${esc(S.regions[k].inRegion)}</span></h2>
    <p class="lead">Electricity rates for paying by Direct Debit, per kWh and per day.${cap ? ` For comparison, the price cap is ${p1(cap.unitRate)} per kWh and ${p1(cap.standingCharge)} a day (Great Britain average).` : ''}</p>
    <div class="table-scroll">
      <table>
        <thead><tr><th>Tariff</th><th>Price</th><th>Unit rate</th><th class="p">Standing charge</th><th>Exit fee</th><th>You need</th></tr></thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  </section>

  <section class="others" aria-labelledby="pick-h">
    <h2 id="pick-h">Read more about each tariff</h2>
    <ul class="tariff-cards">${PAGES.map((p) => `<li><a href="/${SECTION}/${p.slug}/"><b>${esc(p.name)}</b><span>${esc(p.oneLine)}</span></a></li>`).join('')}</ul>
  </section>
${switchSection('your new tariff', '<b>Choose your tariff in your account.</b> Once your supply has moved, change to Agile Octopus, Intelligent Octopus Go or Octopus Tracker in the app or online account. Smart tariffs need a smart meter that Octopus Energy can read.', ref)}
${faqSection('faq-h', 'Choosing an Octopus Energy tariff: common questions', faqs)}
${footer(cap)}` + tail(S, 'tariffs-hub');
}

/** Writes the hub and the four tariff pages. Returns their URLs for the sitemap. */
export async function buildTariffPages({ outDir, base, PR, cfg, tariffs, dataset, history, today }) {
  const S = tariffSummary({ tariffs, dataset, history, today, PR });
  const k = PR.REGIONS[cfg?.defaultRegion] ? cfg.defaultRegion : DEFAULT_REGION;
  const cap = cfg?.priceCap && (!cfg.priceCap.to || today <= cfg.priceCap.to) && today >= cfg.priceCap.from ? cfg.priceCap : null;
  const ref = cfg?.referralUrl || '';
  const fill = (html) => html.replaceAll('{{REF}}', esc(ref));
  const urls = [];

  await mkdir(join(outDir, SECTION), { recursive: true });
  await writeFile(join(outDir, SECTION, 'index.html'), fill(hubPage({ S, k, base, cap, ref, PR })));
  urls.push(`${base}/${SECTION}/`);
  for (const p of PAGES) {
    await mkdir(join(outDir, SECTION, p.slug), { recursive: true });
    await writeFile(join(outDir, SECTION, p.slug, 'index.html'), fill(tariffPage({ p, S, k, base, cap, ref, PR })));
    urls.push(`${base}/${SECTION}/${p.slug}/`);
  }
  return urls;
}
