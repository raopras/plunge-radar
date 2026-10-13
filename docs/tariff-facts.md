# Octopus tariff guide: facts sheet

Checked 13 October 2026. Every claim on the /octopus-tariffs/ pages comes from this list.
Rates are for paying by monthly Direct Debit. There's no VAT on electricity from 1 Oct 2026 to 31 Mar 2027:
the API now shows the same value with and without VAT (Tracker days before 1 October included 5%).

## Joining and the referral
- Agile Octopus, Intelligent Octopus Go and Octopus Tracker are only for existing Octopus Energy customers. New customers join first (Octopus suggests Flexible Octopus), then change tariff in their account. Sources: Agile and Tracker pages; Intelligent Octopus Go page ("Non-Octopus customers must first switch to Flexible Octopus").
- Refer a friend: both sides get £50 credit once the new customer is on supply and their first Direct Debit is paid, usually about four weeks. Sign-ups through a third party such as a comparison site don't count. A customer who joined directly on the website without a link can contact Octopus with the code. Source: octopus.energy/blog/octopus-referrals/
- Rules: no paid ads; don't spam third-party sites; don't use Octopus's name or branding in a way that suggests you're official. **Risk to note:** Octopus says the personal link is meant for people you know, and if it looks shared publicly or used commercially it may move you to a more suitable scheme (the business affiliate scheme pays £50 per customer).

## Agile Octopus (AGILE-24-10-01)
- Half-hourly prices tied to wholesale prices; next day's prices published 4pm to 8pm, usually nearer 4pm. Capped at 100p/kWh. Can go below zero (plunge pricing). Needs a smart meter Octopus can read remotely (SMETS2, or SMETS1 made by Secure); connection usually takes around 14 days.
- API: 12-month term, exit fee £0. London standing charge 37.65p a day.

## Intelligent Octopus Go (IOG-SMB-FIX-12M-26-10-01, "12M Fixed")
- Fixed rates, 12 months, £50 exit fee (API and product page).
- Cheap rate 11:30pm to 5:30am for the whole home, plus smart charging at the cheap rate for up to 6 hours in every 24, including outside the window. Bump charges at the day rate.
- London: 7.6p cheap rate, 35.88p day rate, 42.29p a day standing charge. Cheap rate is 7.6p in all regions.
- Needs a supported car or charger and a smart meter.
- Not used: the "EV Saver" variant (IOG-SMB-FIX-OEV-12M-26-10-01).

## Octopus Tracker (SILVER-26-04-01, electricity only)
- One price a day: (previous day's N2EX day-ahead baseload price × regional multiplier) + regional adder. London: × 1.30 + 9.717p. Capped at 100p/kWh.
- 12-month term; formula and standing charge fixed for the term; no exit fee; leave during the term and you wait 9 months to rejoin.
- Octopus says prices tend to be lower in warmer months and higher in colder months.
- Needs a working smart meter; Economy 7 meters have to be reconfigured to one register.
- London today (13 Oct): 25.04p; standing charge 40.40p a day.
- Not in the public /products/ list, so its code is set in scripts/fetch-tariffs.mjs (TRACKER_CODES). When Octopus launches a new version, add the new code.

## Flexible Octopus (VAR-22-11-01)
- Variable; usually updates every 3 months; no exit fees; any meter.
- London: 26.60p per kWh, 41.39p a day.

## Price cap (for comparison)
- Ofgem GB average, single-rate electricity, Direct Debit, 1 Oct to 31 Dec 2026: 26.32p per kWh, 54.83p a day (site/config.js).

## Sources
- https://octopus.energy/smart/agile/
- https://octopus.energy/smart/intelligent-octopus-go/
- https://octopus.energy/smart/tracker/ and https://octopus.energy/tracker-faqs
- https://octopus.energy/tariffs/
- https://octopus.energy/blog/octopus-referrals/
- https://api.octopus.energy/v1/products/ (and each product's detail and unit-rate endpoints)
