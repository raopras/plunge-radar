# Plunge Radar

A free, self-updating web page showing today's and tomorrow's **Agile Octopus** half-hourly electricity prices for every UK region, with the cheapest and dearest times in plain English and a highlight whenever prices go below zero. Each page carries your Octopus referral link.

Live at **https://plungeradar.co.uk**. It is a static site on **GitHub Pages**. A scheduled **GitHub Action** fetches new prices every afternoon, saves them to the repo and republishes the page. After setup there is nothing to run, host or pay for.

## How it works

1. Every hour from 15:07 to 22:07 UTC (4pm onwards UK time, summer and winter), the Action runs `scripts/fetch-prices.mjs`.
2. The script finds the current Agile product, gets its 14 regional tariff codes, then pulls half-hourly prices from UK midnight today to midnight after tomorrow, in UTC, following every results page.
3. It writes `site/data/latest.json` (with the cheapest and dearest 2-hour windows and any below-zero runs worked out) and one small file per complete day in `site/data/archive/`.
4. If anything changed, the Action commits the data and republishes the site. Once tomorrow is stored, later runs that day stop straight away without calling the API.

Only public, no-key endpoints are used: `/v1/products/`, `/v1/products/{code}/` and `.../standard-unit-rates/`.

### "Which region am I in?"

Visitors can type a postcode (or the MPAN from their electricity bill) instead of picking from the list. The logic is in `site/regions.js`:

1. The input is checked first: full postcode, first half only (e.g. `CR8`), or an MPAN. Unknown areas, Northern Ireland, the Channel Islands and the Isle of Man get a clear message.
2. A full postcode is looked up in the browser with Octopus's public `/v1/industry/grid-supply-points/` endpoint, which gives the exact region.
3. If that can't be reached, the page uses its built-in postcode-area table. Areas that straddle a boundary (Croydon, Kingston, Peterborough and a few others) show the possible regions as buttons and suggest the MPAN for an exact answer.
4. The MPAN's first two digits (10 to 23) identify the region exactly, with no network call.

### Installable web app

The site has a web app manifest, icons and a small service worker (`site/sw.js`). On a phone, visitors can choose **Add to Home Screen** and it opens full screen like an app. It always fetches fresh prices when online and shows the last saved prices when offline. If you ever change the files a lot, bump `CACHE` in `site/sw.js` (for example to `plunge-radar-v2`).

## Set up (about 10 minutes, once)

You need a free GitHub account.

1. **Create a repository.** On GitHub, click **New repository**, name it (for example `plunge-radar`), make it **Public**, and create it.
2. **Upload the files.** Click **uploading an existing file**, drag in everything from this folder (keep the `.github` folder; on a Mac press Cmd+Shift+. in Finder to see it), and click **Commit changes**.
3. **Check your referral link.** `site/config.js` already contains `https://share.octopus.energy/silk-snail-210`. Change it there if you ever get a new link; every switch button on the page uses it.
4. **Turn on Pages.** Go to **Settings → Pages**, and under **Source** choose **GitHub Actions**.
5. **Run it once by hand.** Go to **Actions → Update Agile prices → Run workflow**. After a minute or two the run shows a link to your site, like `https://<your-username>.github.io/plunge-radar/`.

That's it. From now on it updates itself every afternoon.

### Optional: your own domain

In **Settings → Pages → Custom domain**, enter your domain and follow GitHub's DNS instructions. Nothing in the code needs to change.

## The daily schedule

| When (UTC) | What happens |
| --- | --- |
| 15:07–22:07, hourly | Fetch tomorrow's prices. Stops calling the API once all 14 regions are complete. |
| 00:07 | Heartbeat: rolls the stored days forward. |
| Any push to `main` | Tests run and the site republishes with your changes. |

GitHub sometimes starts scheduled runs 10–30 minutes late at busy times; that's normal.

GitHub pauses schedules on repositories with no activity for 60 days. The daily data commits count as activity, so this shouldn't happen. If a run ever fails, GitHub emails you.

## Things you might change

| What | Where |
| --- | --- |
| Referral link, reward amount, default region | `site/config.js` |
| Wording on the page | `site/index.html` |
| Colours and fonts | `site/styles.css` (tokens at the top) |
| Schedule | `.github/workflows/update-prices.yml` |
| Force a specific Agile product | Set `AGILE_PRODUCT_CODE` in the workflow's `Fetch prices` step |

When Octopus changes the referral reward, update `referralReward` in `site/config.js`; the page uses it everywhere.

## Run it on your own computer (optional)

Needs Node.js 20 or newer.

```bash
npm test            # unit tests + an end-to-end run against a mock API
npm run fetch       # fetch live prices into site/data/
npm run serve       # preview at http://localhost:3000
```

Useful settings for `npm run fetch`: `FORCE=1` refetches even when cached; `PLUNGE_NOW=2026-10-24T17:00:00Z` pretends it's a different time.

## Data format

`site/data/latest.json`:

```json
{
  "generatedAt": "2026-10-12T15:07:41Z",
  "product": "AGILE-24-10-01",
  "units": "pence per kWh, including 5% VAT",
  "regions": { "A": "Eastern England", "...": "..." },
  "days": {
    "2026-10-13": {
      "start": "2026-10-12T23:00:00.000Z",
      "slots": 48,
      "regions": {
        "C": {
          "tariff": "E-1R-AGILE-24-10-01-C",
          "prices": [12.4, 11.9, "... one per half-hour from UK midnight ..."],
          "summary": { "avg": 15.2, "min": -1.3, "max": 31.8, "cheapest2h": { "start": 26, "end": 30, "avg": 4.1 }, "negatives": [] }
        }
      }
    }
  }
}
```

A day has 48 half-hours, 46 when the clocks go forward and 50 when they go back; the page handles all three. Archive files hold just the prices per region and are the starting point for daily archive pages later.

## Rules to stay within

- **No paid ads** promoting the referral link (including boosted posts). Octopus suspends links shared through paid advertising.
- Keep the disclosure in the footer: it says the link is a referral link and that the site is independent of Octopus Energy.
- Don't use the Octopus logo or branding.
- Check the current referral terms on octopus.energy before big promotional pushes; they change from time to time.

## Licence

Copyright (c) 2026 Pras Rao. All rights reserved.

This is not open-source software. The code is public so it can be viewed, but no one may use, copy, modify or redistribute it without written permission from Pras Rao. See [LICENSE](LICENSE) for the full terms.
