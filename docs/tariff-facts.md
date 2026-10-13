# Octopus tariff guide: facts sheet

Checked word for word against each official page on 13 October 2026, in a browser (not a summary). Every claim on the /octopus-tariffs/ pages comes from this list.
Rates are for paying by monthly Direct Debit. There's no VAT on electricity from 1 Oct 2026 to 31 Mar 2027:
the API now shows the same value with and without VAT (Tracker days before 1 October included 5%).

## Joining and the referral
- Agile Octopus, Intelligent Octopus Go and Octopus Tracker are only for existing Octopus Energy customers. Agile page: "you'll join us on one of our standard tariffs initially". Tracker page: "switch to our standard tariff, Flexible Octopus, then return to this page". Intelligent Octopus Go FAQs: "Be an Octopus Energy customer". Agile and Tracker: Octopus connects to the smart meter (~14 days), then emails you to accept the tariff terms.
- Refer a friend: both sides get £50 credit once the new customer is on supply and their first Direct Debit is paid, usually about four weeks. Sign-ups through a third party such as a comparison site don't count. A customer who joined directly on the website without a link can contact Octopus with the code. Source: octopus.energy/blog/octopus-referrals/
- Rules: no paid ads; don't spam third-party sites; don't use Octopus's name or branding in a way that suggests you're official. **Risk to note:** Octopus says the personal link is meant for people you know, and if it looks shared publicly or used commercially it may move you to a more suitable scheme (the business affiliate scheme pays £50 per customer).

## Agile Octopus (AGILE-24-10-01)
- Half-hourly prices tied to wholesale prices; next day's prices published 4pm to 8pm, usually nearer 4pm. Capped at 100p/kWh. Can go below zero (plunge pricing). Needs a smart meter Octopus can read remotely (SMETS2, or SMETS1 made by Secure); connection usually takes around 14 days.
- Agile page: best suited to customers who can shift large amounts of use to avoid peaks; peaks usually 4pm to 7pm; prices can spike up to 100p at any time; the page also says it's likely you'll save more on a standard variable or fixed tariff through the winter when wholesale prices are high.
- API: 12-month term, exit fee £0. London standing charge 37.65p a day.

## Intelligent Octopus Go (IOG-SMB-FIX-12M-26-10-01, "12M Fixed")
- Fixed rates, 12 months, £50 exit fee (API and product page).
- Cheap rate 11:30pm to 5:30am for the whole home, plus smart charging at the cheap rate for up to 6 hours in every 24, including outside the window. Bump charges at the day rate.
- London: 7.6p cheap rate, 35.88p day rate, 42.29p a day standing charge. Cheap rate is 7.6p in all regions.
- Needs (FAQs): Octopus Energy customer, active smart meter sending half-hourly data, compatible car or charger, compatible iOS or Android device. Over 280 cars supported. First 6 hours of smart charging a day billed off-peak whenever they happen; unscheduled charging and bump charges at the day rate; home charging only. Tariffs page: Octopus Go for cars or chargers that aren't compatible.
- Octopus says IOG customers typically saved £771 (May 2025 to April 2026) against Flexible Octopus.
- Not used: the "EV Saver" variant (IOG-SMB-FIX-OEV-12M-26-10-01).

## Octopus Tracker (SILVER-26-04-01, electricity only)
- One price a day: (previous day's N2EX day-ahead baseload price × regional multiplier) + regional adder. London: × 1.30 + 9.717p. Capped at 100p/kWh.
- 12-month term; formula and standing charge fixed for the term; no exit fee; leave during the term and you wait 9 months to rejoin.
- Tracker page: "In warmer months, prices tend to be lower, then typically increase – likely double – in colder months." If you can't afford prices that high, Octopus says you're probably better off on a protected tariff such as Flexible Octopus. Tariffs page: choose Tracker if you can use energy flexibly, cutting down on pricey days.
- Needs a working smart meter; Economy 7 meters have to be reconfigured to one register.
- London today (13 Oct): 25.04p; standing charge 40.40p a day.
- Not in the public /products/ list, so its code is set in scripts/fetch-tariffs.mjs (TRACKER_CODES). When Octopus launches a new version, add the new code.

## Flexible Octopus (VAR-22-11-01)
- Variable: "prices will rise or fall every three months with wholesale energy"; "Flexible has no exit fees" (tariffs page). No smart meter needed (Tracker FAQs: stay on a standard tariff such as Flexible until a smart meter is installed).
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
