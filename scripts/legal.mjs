// The disclaimer and terms of use page (plungeradar.co.uk/disclaimer/).
// Plain-English consumer wording under the law of England and Wales.
// It limits liability as far as the law allows and says what can't be excluded:
// UK law doesn't let a website exclude everything, and pretending otherwise
// makes the rest of the text easier to challenge.

export const DISCLAIMER_UPDATED = '13 October 2026';

// Contact address, written as HTML character codes so simple spam bots don't pick it up.
export const CONTACT_EMAIL = 'raoprasji@gmail.com';
const encode = (s) => [...s].map((c) => `&#${c.codePointAt(0)};`).join('');
export const emailLink = () => `<a href="${encode('mailto:' + CONTACT_EMAIL)}">${encode(CONTACT_EMAIL)}</a>`;

export const DISCLAIMER_SECTIONS = [
  ['About this site', [
    'Plunge Radar (plungeradar.co.uk) is a free, independent information website run by Pras Rao. It shows half-hourly prices for Agile Octopus, a variable electricity tariff from Octopus Energy, for each region of Great Britain, and compares four Octopus Energy tariffs (Agile Octopus, Intelligent Octopus Go, Octopus Tracker and Flexible Octopus), using Octopus Energy\'s public data.',
    'Plunge Radar is not affiliated with, endorsed by or acting for Octopus Energy. We don\'t supply energy, we can\'t switch you or see your account, and we aren\'t a price comparison service accredited under Ofgem\'s Confidence Code.',
  ]],
  ['Information only, not advice', [
    'Everything on this site is general information. It isn\'t financial, energy, legal or other professional advice, and it isn\'t a recommendation that any tariff or supplier is right for you.',
  ]],
  ['Check prices and data yourself', [
    'Prices come from Octopus Energy\'s public data and are shown including any VAT due (there is no VAT on electricity from 1 October 2026 to 31 March 2027), in UK time. They may be delayed, incomplete or wrong, and Octopus Energy may change them. Standing charges and your own usage aren\'t included, so the figures don\'t show what your bill will be.',
    'The cheapest and dearest times, plunge alerts, regional rankings, history, tariff comparisons, price cap comparisons, savings estimates and example earnings (such as for an electric car charger) are worked out automatically and are illustrations only. The tariff quiz gives a general suggestion from four answers and doesn\'t know your home, your usage or your circumstances. The price cap figure is Ofgem\'s GB average, and the cap in your region may differ slightly. The region checker uses your postcode or MPAN to find a likely region and can be wrong, especially near region boundaries.',
    'Before you act on anything here, check the prices for your own tariff and region in your Octopus Energy account or app.',
  ]],
  ['Decide whether a tariff suits you', [
    'Agile Octopus prices change every half-hour and follow the wholesale market. They can be higher than a standard or capped tariff, particularly from 4pm to 7pm, and Octopus Energy says they can spike up to 100p per kWh at any time. Past prices don\'t predict future prices, and there is no guarantee of savings.',
    'Agile needs a smart meter that sends half-hourly readings. It tends to suit homes that can move their electricity use to cheaper times. If you can\'t easily change when you use power, rely on electricity for medical equipment or heating, or need predictable bills, a fixed or standard tariff may suit you better.',
    'Octopus Tracker prices change daily and can be much higher in winter. Intelligent Octopus Go has a higher day rate and an exit fee, and only works with supported cars and chargers. Flexible Octopus prices can rise when Octopus Energy reviews them. Tariff rates, terms and eligibility are set by Octopus Energy and can change at any time.',
    'Before switching, check your current supplier\'s exit fees and Octopus Energy\'s own terms. For free, impartial help, contact Citizens Advice or read Ofgem\'s guidance. The decision to switch, and to use electricity at any particular time, is yours.',
  ]],
  ['Use appliances safely', [
    'Cheap prices are often overnight. Always follow the manufacturer\'s instructions and fire safety advice. For example, don\'t leave tumble dryers, washing machines or dishwashers running while you\'re asleep or out, and only charge an electric vehicle with suitable, properly installed equipment.',
  ]],
  ['Referral links', [
    'Buttons marked as referral links take you to Octopus Energy. If you join through one, you and Plunge Radar may each receive account credit. Octopus Energy sets the amount, who qualifies and when it is paid, and can change or withdraw the scheme. We don\'t control the switching process or your energy supply. Questions or complaints about your supply should go to Octopus Energy and, if unresolved, the Energy Ombudsman.',
  ]],
  ['Our liability', [
    'This site and its content are provided "as is" and "as available". We don\'t promise that the site or its data will be accurate, complete, up to date, available or free from errors or viruses.',
    'To the fullest extent permitted by law, Pras Rao and Plunge Radar are not liable for any loss or damage arising from your use of, or reliance on, this site, its data or calculations, or any linked site. This includes higher energy bills, savings you expected but didn\'t make, missed cheap or negative-price periods, lost or withheld referral credit, and any indirect or consequential loss.',
    'We are not responsible for the content, services or actions of other websites, including Octopus Energy\'s.',
    'Nothing in this disclaimer excludes or limits liability for death or personal injury caused by negligence, for fraud or fraudulent misrepresentation, or for anything else that cannot be excluded or limited under the law of England and Wales. Your statutory rights are not affected.',
  ]],
  ['Privacy', [
    'We count page visits and button clicks with Umami, which is anonymous and doesn\'t use cookies. When you use the region checker with a full postcode, your browser sends that postcode to Octopus Energy\'s public data service to look up your region; we don\'t store it. Your chosen region is saved only in your own browser.',
  ]],
  ['Changes, copyright and law', [
    'We may change, suspend or remove this site, or this disclaimer, at any time. The version on this page applies from the date shown.',
    'The site\'s design, text and code, including the tariff finder\'s questions, rules and wording and the calculators, are © 2026 Pras Rao, all rights reserved. Price data belongs to Octopus Energy. "Octopus Energy" and "Agile Octopus" are trade marks of their owner.',
    'You may use the site and its tools for your own personal use, and link to any page. You must not copy, scrape, frame or republish the site, its tools or its code, in whole or in substantial part, or use automated tools to collect its content or train AI models on it, without written permission.',
    'This disclaimer is governed by the law of England and Wales. If you live in Scotland or Northern Ireland, you can also bring proceedings in your local courts.',
  ]],
  ['Contact', [
    'Email {{EMAIL}} with any questions about this site. Plunge Radar is run by Pras Rao, a sole trader.',
    'Postal address: c/o SoloStarterHQ, 80A Ruskin Ave, Welling, London DA16 3QQ, United Kingdom.',
  ]],
];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function disclaimerPage({ base }) {
  const url = `${base}/disclaimer/`;
  const title = 'Disclaimer and Terms of Use | Plunge Radar';
  const description = 'Plunge Radar shows Agile Octopus tariff prices for information only. Check data yourself, decide if Agile suits you, and see the limits of our liability.';
  const sections = DISCLAIMER_SECTIONS.map(([h, ps], i) => `
    <section class="legal-section" id="s${i + 1}">
      <h2>${i + 1}. ${esc(h)}</h2>
      ${ps.map((p) => `<p>${esc(p).replace('{{EMAIL}}', emailLink())}</p>`).join('\n      ')}
    </section>`).join('\n');
  const ld = {
    '@context': 'https://schema.org', '@type': 'WebPage', name: 'Disclaimer and Terms of Use', url, description, inLanguage: 'en-GB',
    isPartOf: { '@type': 'WebSite', name: 'Plunge Radar', url: `${base}/` },
  };
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:locale" content="en_GB">
<meta property="og:site_name" content="Plunge Radar">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${base}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0E1A2E">
<link rel="icon" href="/icons/icon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@700;800;900&family=IBM+Plex+Mono:wght@500;700&family=Public+Sans:wght@400;600;700&display=swap">
<link rel="stylesheet" href="/styles.css">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
</head>
<body>
<header class="hero">
  <div class="hero-inner">
    <a class="brandline brand-link" href="/">
      <svg class="mark" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="var(--cta)"/><path d="M5 12h4l3 10 4-16 4 13 2-5h5" fill="none" stroke="var(--cta-ink)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span class="wordmark">Plunge Radar</span>
    </a>
    <h1>Disclaimer and terms of use</h1>
    <p class="hero-lede">Plunge Radar shows Agile Octopus tariff prices for information only. Check everything yourself before you act, and decide whether Agile suits your home.</p>
    <p class="fine">Last updated ${DISCLAIMER_UPDATED}.</p>
  </div>
</header>
<main class="wrap legal">
  <a class="finder-strip" href="/octopus-tariffs/tariff-finder/" data-strip="finder"><span class="fs-icon" aria-hidden="true">?</span><span class="fs-text"><b>Which Octopus Energy tariff suits your home?</b> <span>Answer 7 quick questions about your car, heating, solar panels and when you're home.</span></span><span class="fs-go">Find my tariff <span aria-hidden="true">→</span></span></a>
  <div class="card legal-summary">
    <h2>In short</h2>
    <ul>
      <li>This is an independent information site, not advice, and not part of Octopus Energy.</li>
      <li>Prices and calculations can be wrong or out of date. Check your own Octopus account before acting.</li>
      <li>Agile can cost more than other tariffs at times. Only you can decide if it suits you.</li>
      <li>Follow safety advice when running appliances at off-peak times.</li>
      <li>We aren't liable for losses from using the site, as far as the law allows. Your statutory rights are not affected.</li>
    </ul>
  </div>
${sections}
  <p><a href="/">Back to today's Agile Octopus prices</a></p>
  <footer class="small"><p>&copy; 2026 Pras Rao. All rights reserved.</p></footer>
</main>
</body>
</html>
`;
}
