# Octopus Plunge Radar — project knowledge

Owner: **Pras Rao** (raoprasji@gmail.com). All rights reserved; see `LICENSE`.
Live: **https://plungeradar.co.uk** (GitHub Pages, custom domain, HTTPS). Repo: `raopras/plunge-radar`.

## Purpose

Earn Octopus Energy referral credit by helping people use the **Agile Octopus** tariff well. Every switch through Pras's personal refer-a-friend link (`https://share.octopus.energy/silk-snail-210`) earns £50 credit for him and for the person switching. Pras chose the personal link, not the business affiliate route (which pays cash; worth revisiting once traffic proves out).

Honest reality check given to Pras: the main search audience (people checking Agile prices) is mostly existing customers who can't use a referral. Converting traffic needs content for people *considering* switching. Estimate without his involvement: ~0/week for 1–2 months, maybe 1–2/week by months 4–6 if Google ranks the region pages.

## Rules that must never be broken

- **No paid advertising** of the referral link (Octopus suspends links promoted by paid ads: 3 months, then 6). Growth is organic only: SEO, sharing, social.
- **Disclose the referral link** beside every switch button, and say the site is independent of Octopus Energy. No Octopus logo or branding.
- **Naming:** "Agile Octopus" = the tariff, "Octopus Energy" = the company. Never "Octopus Agile". Explain early that Agile Octopus is a tariff. The SEO audit enforces this.
- **Ground everything in Octopus Energy's official sources (Pras, 13 Oct 2026).** Every price, claim, promise and requirement must come from octopus.energy pages or the Octopus Energy API, read word for word in a browser (never a summariser), and be recorded with its quote in `docs/tariff-facts.md`. If it isn't on an official page, it doesn't go on the site.
- **Referral link:** keep using the personal link everywhere it fits until Octopus Energy flags it (Pras's decision, 13 Oct 2026; Octopus says the link is "meant for people you know").
- **Don't over-promise.** Switching takes time and needs a smart meter; Agile can cost more than a standard tariff at 4–7pm. Copy must stay honest (Pras rejected "Get paid like this on Agile").
- **Thorough SEO audit at publish time**, not afterwards (Pras's standing preference). `scripts/seo-audit.mjs` runs in CI and blocks the deploy on failure; extend it rather than bypass it.
- **Copy style:** UK English, plain words, active voice. Pras likes working on copy together: offer options with a recommendation, then apply his choice exactly.
- Prompts written for Pras use his **ART** format: Act as / Request / Terms.

## How it works

```
GitHub Action (hourly 15:07–22:07 UTC + 00:07 UTC, on push, or by hand)
  npm test → scripts/fetch-prices.mjs → scripts/build-site.mjs → scripts/seo-audit.mjs
  → commit site/data if changed → deploy _site/ to GitHub Pages
```

- `scripts/fetch-prices.mjs` uses only public Octopus endpoints: `/v1/products/` (finds the current Agile product, e.g. `AGILE-24-10-01`), `/v1/products/{code}/` (regional tariff codes), `.../standard-unit-rates/` (UTC times with trailing Z, follows `next` paging). It writes `site/data/latest.json` (yesterday/today/tomorrow, prices per half-hour from UK midnight, with summaries) and `site/data/archive/YYYY-MM-DD.json` for each complete day. It skips API calls when today is complete and tomorrow is published.
- **Agile publishes 11pm–11pm**, so a calendar day's last hour (2 slots) only arrives with the next day's prices at ~4pm. `dayIsPublished` allows those 2 trailing gaps; `dayIsComplete` (archive) doesn't. Days have 46/48/50 slots around clock changes.
- `scripts/build-site.mjs` copies `site/` to `_site/` and generates:
  - 14 region landing pages (`/london/`, `/south-east-england/`…) from `site/index.html` as a template, with today's numbers written into the HTML, local facts (places, postcode areas, MPAN prefix, network operator, ranking), recent-days history from the archive, FAQ, and JSON-LD (Breadcrumb, WebPage, FAQPage)
  - a "Agile prices across Great Britain" table at the `<!--build:compare-->` marker on all pages
  - `/disclaimer/` (text in `scripts/legal.mjs`), `404.html`, `sitemap.xml`
- `site/regions.js` is the single source for region names, slugs, in-sentence names, MPAN prefixes, network operators, the postcode-area table, and the postcode/MPAN checker. Exact lookups use Octopus `/v1/industry/grid-supply-points/?postcode=` in the browser, falling back to the area table. **Unverified:** the postcode-area table, operator mapping, and whether that endpoint allows browser (CORS) calls.
- `site/app.js` renders the page. Region pages set `window.PLUNGE_PAGE = { region, base: '../' }`; the picker and postcode checker navigate between region pages. It also handles the Plunge Alert (Tomorrow / Later today / Happening now / Earlier today), the sticky phone bar (hides while another switch button is on screen), Umami tracking and the service worker.
- `site/config.js`: referral URL, reward (£50), default region (C), Umami Website ID `3b273825-6d33-4f07-ae92-3d5da7163d83`.
- Click tracking: Umami (cookie-free) events `referral-click` {button: hero|plunge|promo|steps|sticky, region, page} and `postcode-check` {result, region}. Completed switches only show in Pras's Octopus account (referral credits).
- Installable web app: `manifest.webmanifest`, icons, `sw.js` (network-first). **Bump `CACHE` in `site/sw.js` on every release.**

## Price cap, savings calculator and VAT (added 12 Oct 2026)

- `site/config.js` → `priceCap` holds Ofgem's GB-average single-rate Direct Debit cap (unit rate, standing charge, period). **Update it every quarter** (next: from 1 Jan 2027). After `to`, the cap line, cap note and calculator hide themselves rather than show stale figures.
- Regional cap rates sit behind a CAPTCHA on Ofgem's site, so the page uses the GB average and says so.
- `scripts/backfill-history.mjs` runs in CI before the price fetch (continue-on-error) and fills missing archive days from `priceCap.from`; it makes no API calls once the archive is complete.
- The build writes `data/history/<region>.json` (days since `priceCap.from`) for the calculator, which replays them against a typical household profile and compares unit costs only.
- **VAT:** no VAT on electricity from 1 Oct 2026 to 31 Mar 2027. Copy says "including any VAT due". Revisit wording in April 2027.

## Operations and recovery (added 13 Oct 2026)

What failed on 12–13 Oct: a test read the live archive in `site/data`, broke as the archive grew, and because tests ran before every scheduled price update, no prices were saved for ~12 hours. Separately, GitHub skipped 7 of 9 scheduled runs on 12 Oct (scheduled runs are best-effort). Nobody was alerted. Safeguards now in place:

- **Tests are hermetic:** every test copies `site/` *without* `site/data` and uses fixed dates. Never let a test read live data or today's date.
- **Scheduled runs skip the tests** (code doesn't change on a schedule); pushes and manual runs still run them. Build + SEO audit still gate every deploy.
- **Many schedule slots:** every 15 min 15:00–22:45 UTC plus 6 runs through the day; no-op runs exit in seconds.
- **Self-healing pages:** `site/live.js` fetches today's/tomorrow's Agile prices for the visitor's region straight from the Octopus API (CORS allowed) when `latest.json` is missing them. Its maths mirrors `scripts/lib.mjs`; `test/live.test.mjs` checks they agree, including clock-change days.
- **Alerts:** a failed price update opens/updates a GitHub issue "Price update failing" (emailed to Pras); the next success closes it. `.github/workflows/health-check.yml` checks the live site after every update and 5 times a day (`scripts/health-check.mjs`: pages load, referral links present, today's/tomorrow's prices, tariff data < 36 h, Tracker rates current) and raises "Site health check failing".
- **Tracker code changes:** `fetch-tariffs.mjs` finds a new `SILVER-YY-MM-DD` product by itself when the known code closes; add the new code to `TRACKER_CODES` when the log says so.
- **Pages never say "today" for built data:** tariff pages name the date of each price, because a rebuild can slip.
- The bot's data commit does `git pull --rebase` before pushing, so a code push during a run doesn't fail it.

## Working on it

- `npm test` (node:test; includes a mock-API end-to-end run, build checks and the SEO audit), `npm run build`, `npm run audit`, `npm run serve`.
- The CI bot commits price data hourly, so before pushing: `git fetch origin main && git rebase origin/main`.
- Commits are authored as Pras (`raopras@users.noreply.github.com`).
- After every deploy, **check the live site in a real browser** (the Claude browser on Pras's computer). Previews have hidden bugs before (the `[hidden]` override) that only showed on the real site.
- Gotchas: `styles.css` needs `[hidden]{display:none!important}` (classes with `display` otherwise override `hidden`); `.wrap > * { min-width: 0 }` prevents sideways scroll at 320px; the contact email is written as HTML character codes (`emailLink()` in `legal.mjs`).
- This workspace can't reach api.octopus.energy, so test fetch logic with the mock API in tests. Live fetching happens in GitHub Actions.
- Google Search Console (domain property `sc-domain:plungeradar.co.uk`): home page live test passed and indexing was requested on 12 Oct 2026. The sitemap showed "Couldn't fetch" (not yet read); recheck after a few days.

## Octopus tariff guide (/octopus-tariffs/, added 13 Oct 2026)

- Hub (`/octopus-tariffs/`: 4-question quiz, comparison table) plus `/agile/`, `/intelligent-octopus-go/`, `/tracker/` (electricity only), `/flexible/`. Built by `scripts/tariff-pages.mjs`; client code in `site/tariffs.js` (region switch, quiz, copy-link box, sticky bar, Umami events `referral-click` {button, page, region, tariff}, `referral-copy`, `tariff-quiz`).
- Aim: referral income. Every page has the referral link in the hero, quiz result, switch steps, sticky bar and a copy-link box, with disclosure and the independence note. Agile, Go and Tracker need an existing Octopus account, so the copy says: join on Flexible Octopus with our link, then change tariff.
- `scripts/fetch-tariffs.mjs` writes `site/data/tariffs.json` (CI step, continue-on-error, keeps last good values). Tracker isn't in `/v1/products/`: update `TRACKER_CODES` when Octopus launches a new Tracker version.
- Facts and sources: `docs/tariff-facts.md`. The SEO audit now walks nested pages, checks tariff names and checks every referral button has a disclosure.

## Legal

`/disclaimer/` is plain-English UK consumer wording (England and Wales law): information only, check data yourself, decide whether Agile suits you, appliance safety, referral terms, liability limited "to the fullest extent permitted by law" **with the statutory carve-outs** (death or injury from negligence, fraud; statutory rights unaffected). Never claim total exclusion of liability, because UK law won't enforce it. Suggested to Pras: solicitor review before scaling up promotion.

## Backlog and ideas

- **Switch Verdict calculator**: replay a household's half-hourly usage against every Octopus tariff ("would Agile have saved you money?"). Targets non-customers, the best converter.
- **Plug & Price**: EV and heat pump running-cost pages by region and tariff.
- **Move-In Kit**: a white-label page for letting agents (business affiliate route).
- Daily social posts (Instagram/TikTok) using the share card. Pras must create accounts and approve each public post.
- **Weekly report**: Pras wants one. The first scheduled-task attempt (Mondays, reading Umami and Search Console via the Claude browser) was declined; agree the delivery method with him first. Umami needs a sign-in in the Claude browser.

## Tradedoubler (added 19 Oct 2026)

- Site ID 3503369. `site/3503369.html` is an intentionally empty file that proves site ownership to Tradedoubler. Keep it while the site is in their network. The SEO audit only walks `index.html` pages, so it ignores this file.

## Tariff finder (/octopus-tariffs/tariff-finder/, added 20 Oct 2026)

- Seven questions (electric car and Intelligent Octopus Go compatibility, heating, solar/battery, someone home in the day, flexibility, price certainty, smart meter). Rules and tariff facts in `site/finder-rules.js` (loaded on that page only, before `tariffs.js`; also imported by `tariff-pages.mjs` for the glance table). UI in `tariffs.js` (`setupFinder`), Umami event `tariff-finder`.
- Picks follow Octopus Energy's smart tariff guide (octopus.energy/blog/which-smart-tariff/) and the tariffs page; `test/finder.test.mjs` checks Octopus Energy's table and all 1,620 answer combinations. When Octopus Energy changes that guide, update the rules, the table on the page and the test together.
- Intelligent Octopus Go is now 8p/kWh (October 2026 v2, IOG-SMB-FIX-12M-26-10-14); the old 7.6p/£160 example is gone from Octopus Energy's page, so the EV calculator calls 7,000 miles at 0.301 kWh/mile an example.
