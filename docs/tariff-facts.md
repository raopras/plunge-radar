# Octopus tariff guide: facts sheet

**20 Oct 2026 update:** Octopus Energy launched "Intelligent Octopus Go 12M Fixed October 2026 v2" (API: IOG-SMB-FIX-12M-26-10-14). Its page now says "Smart charge eligible cars from only 8p/kWh" and "Get 6 hours of smart charging for just 8p/kWh, plus six hours every night between 23:30 - 05:30 for your home". The 7.6p figures and the "7,000 miles ... £160" example below are no longer on the page: the site no longer states them, and the electric car calculator labels 7,000 miles at 0.301 kWh per mile as an example (its rates come from the API). Octopus Energy's smart tariff guide (which-smart-tariff, updated 20 Oct 2026) still says "from 7.6p/kWh"; because the two pages disagree, the finder quotes the product page and the live API rate.

Checked word for word against each official page on 13 October 2026, in a browser (not a summary). Every claim on the site (home, region, tariff and disclaimer pages) comes from this list.
Rates are for paying by monthly Direct Debit. There's no VAT on electricity from 1 Oct 2026 to 31 Mar 2027:
the API now shows the same value with and without VAT (Tracker days before 1 October included 5%).

## Joining and the referral
- Agile Octopus, Intelligent Octopus Go and Octopus Tracker are only for existing Octopus Energy customers. Agile page: "you'll join us on one of our standard tariffs initially". Tracker page: "switch to our standard tariff, Flexible Octopus, then return to this page". Intelligent Octopus Go FAQs: "Be an Octopus Energy customer". Agile and Tracker: Octopus connects to the smart meter (~14 days), then emails you to accept the tariff terms.
- Refer a friend: both sides get £50 credit once the new customer is on supply and their first Direct Debit is paid, usually about four weeks. Sign-ups through a third party such as a comparison site don't count. A customer who joined directly on the website without a link can contact Octopus with the code. Source: octopus.energy/blog/octopus-referrals/
- Rules: no paid ads; don't spam third-party sites; don't use Octopus's name or branding in a way that suggests you're official. **Risk to note:** Octopus says the personal link is meant for people you know, and if it looks shared publicly or used commercially it may move you to a more suitable scheme (the business affiliate scheme pays £50 per customer).

## Agile Octopus (AGILE-24-10-01)
- Half-hourly prices tied to wholesale prices; next day's prices published 4pm to 8pm, usually nearer 4pm. Capped at 100p/kWh. Can go below zero (plunge pricing). Needs a smart meter Octopus can read remotely (SMETS2, or SMETS1 made by Secure); connection usually takes around 14 days.
- Agile page: best suited to customers who can shift large amounts of use to avoid peaks; peaks usually 4pm to 7pm; prices can spike up to 100p at any time; the page also says it's likely you'll save more on a standard variable or fixed tariff through the winter when wholesale prices are high.
- Agile page: "Agile's prices are often cheaper when the energy in the grid is greener, and more expensive when energy's dirtier (usually between 4-7pm)"; "whenever more electricity is generated than consumed, energy prices fall – sometimes to the point where prices drop below zero"; Plunge Pricing "lets you ... get paid for the electricity you use".
- Intelligent Octopus Go FAQs: "Energy's usually greenest (and cheapest) overnight."
- Tracker FAQs: "If you don't have a smart meter yet, we can install one at no extra cost."
- Separate Agile price per region: one tariff code per region in the API (E-1R-AGILE-24-10-01-A … -P).
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

## Electric car charging cost page (/electric-car-charging-cost/)
- Intelligent Octopus Go page: "Based on the UK average EV consumption of 0.301 kWh/mile (last checked October 2026) and the 7.6 p/kWh Intelligent Octopus Go off-peak rate, driving a typical EV 7,000 miles a year would cost just £160 in fuel ... Assuming you always smart charge at home with Intelligent Octopus Go for less than 6 hours a night." The calculator's defaults are these figures; a test checks £160.13.
- Intelligent Octopus Go FAQs: "your first 6 hours of smart charging will always be billed at off-peak rates regardless of when it happens"; "any charging we haven't scheduled is charged at your normal home energy rate"; "only works for home charging"; "8% off charging on the go when charging on the Electroverse network"; "Our Octopus engineers can install a charger for you"; "compatible with over 280 cars".
- Regional day rates, off-peak rate and standing charges: Octopus Energy API (four_rate_ev_electricity_tariffs). Flexible Octopus: API.
- Typical household 2,500 kWh a year (both calculators' default): Ofgem letter 'Energy price cap (default tariff) update from 1 July 2026': "From 1 July 2026 price cap levels and typical bills will be expressed in 2026 TDCV of 2,500 kwh of electricity" (previously 2,700 kWh, the 2023 TDCV). Read from the PDF text on ofgem.gov.uk, 13 Oct 2026.
- Price cap 1 Oct to 31 Dec 2026, Ofgem news page: "you will pay on average 26.32 pence per kilowatt hour (kWh). The daily standing charge is 54.83 pence per day ... It does not include VAT from 1 October 2026 to 31 March 2027."
- The share of home use between 11:30pm and 5:30am is the visitor's own guess, labelled as such; it isn't presented as a fact.

## Price cap (for comparison)
- Ofgem GB average, single-rate electricity, Direct Debit, 1 Oct to 31 Dec 2026: 26.32p per kWh, 54.83p a day (site/config.js).

## Sources
- https://www.ofgem.gov.uk/news/changes-energy-price-cap-between-1-october-and-31-december-2026
- https://www.ofgem.gov.uk/sites/default/files/2026-06/Summary-of-changes-to-energy-price-cap-1-July-to-30-September-2026-revised-TDCV.pdf
- https://octopus.energy/blog/intelligent-go-faqs/
- https://octopus.energy/smart/agile/
- https://octopus.energy/smart/intelligent-octopus-go/
- https://octopus.energy/smart/tracker/ and https://octopus.energy/tracker-faqs
- https://octopus.energy/tariffs/
- https://octopus.energy/blog/octopus-referrals/
- https://api.octopus.energy/v1/products/ (and each product's detail and unit-rate endpoints)

## Tariff finder (/octopus-tariffs/tariff-finder/, added 20 Oct 2026)

Rules and facts live in `site/finder-rules.js`; `test/finder.test.mjs` checks the picks below. All read word for word in Chrome on 20 Oct 2026.

### Octopus Energy's picks (octopus.energy/blog/which-smart-tariff/, "Updated on 20th October 2026")
- Table "Your tech → Smart pick": Solar panels → Outgoing Octopus; Solar + battery → Flux; Solar + battery + heat pump → Flux; Heat pump → Cosy Octopus; EV → Intelligent Octopus Go; Heat pump + EV → Intelligent Octopus Go; EV + solar + battery → Intelligent Octopus Go + Outgoing + Charge Pack; Heat pump + EV + solar + battery → Intelligent Octopus Go + Outgoing + Charge Pack; No smart tech → Agile or Tracker.
- EV: "Works if: Your car or charger is compatible ... If it isn't yet, Octopus Go is the next best option."
- Heat pump or electric boiler: "Works if: You have a heat pump, electric radiators or an electric boiler (they don't need to have been installed by us)."
- Solar without battery: Outgoing Octopus "Pays a flat 12p/kWh"; "When it comes to pulling energy from the grid, your options are exactly the same as anyone else's."
- No smart tech: "Agile is generally worth it if you can shift your power use to less busy times of day, for example if you work from home and can put the laundry on in the middle of the day. Tracker may be a good idea if you want to track the wholesale market ... but don't want to think about your energy use on a half-hourly basis."
- Heat pump + EV: "Intelligent Octopus Go is usually the cheapest option" because "your whole house benefits from the low overnight rates (11:30pm to 05:30am)".
- Charge Pack: "we'll take care of your battery charging and exporting plus you'll make at least £12 a month"; "You can join Charge Pack if you have a smart meter and a supported battery."
- Smart meter: "you must have a working smart meter that sends half-hourly readings"; "You can request a smart meter here (it's free!)".
- **Not used:** the 7.6p figure (the product page now says 8p); the modelling assumptions (2,700 kWh etc.).

### Octopus Energy tariffs page (octopus.energy/tariffs/)
- Flexible: "prices will rise or fall every three months"; choose if you "Might want to change your mind (Flexible has no exit fees)" or "Don't think a smart tariff is right for you".
- Fixed: "Your price won't change for 12 or 18 months"; choose if you "Value certainty in your budget"; "exit fees might apply".
- Gas tariffs listed: Flexible Octopus, Fixed Octopus, Octopus Tracker.
- Smart tariffs: "You'll need a smart meter for any of these options". Cosy: "A heat pump" and "No Intelligent Octopus Go-compatible EV (if you do, IOGo will probably be cheaper)". Flux: "Solar panels and a home battery" and the same EV note. Octopus Go: "An EV or charger that isn't compatible with IOGo". Agile: "Can shift a big chunk of your energy use to less busy times of the day (great if you WFH or have a home battery)". Tracker: "Can use energy flexibly, cutting down on pricey days, using more on cheap days". Snug: "Storage heaters" and "A compatible second-generation smart meter".
- Exit fees (help article "Why do some fixed tariffs have exit fees?"): "If there's an exit fee, it will be clearly stated before you switch"; Flexible "remains a 'no-string' plan with zero exit fees".

### Tariff pages
- Octopus Go (/smart/go/): "super cheap electricity between 00:30 - 05:30 every night"; "Compatible with all EVs and chargers"; "You don't need a home EV charger to join"; "we're only offering fixed rates at the moment. This tariff has a £50 early exit fee"; "you can only pair Octopus Go with certain export tariffs".
- Cosy Octopus (/smart/cosy-octopus/): "Three cosy periods of super cheap rates between 04:00 - 07:00, 13:00 - 16:00 and 22:00 - 00:00 every day, 51% cheaper than the Day rate in your region"; "A peak rate between 16:00 - 19:00, 50% above the Day rate"; fixed version "£50 early exit fee"; "flexible and fixed versions"; "electricity only"; heat pump "doesn't need to have been installed by us".
- Octopus Flux (/smart/flux/): "Super cheap rates between 02:00 - 05:00 every day"; "A peak rate between 16:00 - 19:00, the optimum time to discharge your battery and export"; "Works with all solar and battery systems"; "flexible tariff ... no exit fees or tie-ins"; join Flexible Octopus and Outgoing Octopus first; "We'll need a copy of the MCS document"; Export MPAN ("we can apply for one for you"); "you'll need to manually schedule your battery ... If you want us to control your battery for you (and you have a compatible battery), check out Intelligent Octopus Flux."
- Snug Octopus (/smart/snug-octopus/): "off-peak rate of 9.5p/kWh" between 00:30 and 06:30, during smart charging and the one-hour afternoon boost; "variable tariff"; needs storage heaters controlled by the smart meter and a SMETS2 meter, "not all are compatible"; must "be the Octopus account holder and live at the property"; "You can be on Snug Octopus at the same time as Octopus Outgoing".
- Outgoing Octopus (/smart/outgoing/): "12p per kWh for every unit you export", variable; Prime Outgoing "16p per kWh" 4pm-7pm and "9p per kWh the rest of the day", for solar and battery, 12-month term, no exit fees; Agile Outgoing half-hourly, uncapped, "for those with energy storage", 12-month term, no exit fees; export MPAN from the DNO "1-4 weeks"; needs half-hourly export data; FiT started in the last 12 months can't switch yet.
- Agile (/smart/agile/, rechecked): "best suited to customers who can shift large amounts of their energy use"; "Perfect for electric vehicles, storage heaters, or anyone who can shift their electricity use outside of peak times"; winter warning unchanged.
- Smart meter types (every smart tariff page): "you need either a second generation SMETS2, or a SMETS1 made by Secure"; connection "generally takes us around 14 days".

### How the finder applies them
- Electric car first (compatible or unsure → Intelligent Octopus Go; not compatible → Octopus Go, with Cosy/Flux/Snug as alternatives per the tariffs page), then solar + battery → Flux, heat pump/electric boiler/radiators → Cosy, storage heaters → Snug, otherwise Octopus Energy's no-tech advice: Agile (shift a lot and someone home in the day), Tracker (some flexibility), Flexible (little flexibility or no smart meter), Fixed (wants certainty).
- Solar panels add Outgoing Octopus for export; a battery with an electric car adds Charge Pack.
- Results only show live rates for the four tariffs the site fetches from the API (Agile, Intelligent Octopus Go, Tracker, Flexible).
