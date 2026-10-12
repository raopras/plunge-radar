// The only file you need to edit.
window.PLUNGE_CONFIG = {
  // Your Octopus refer-a-friend link, e.g. "https://share.octopus.energy/calm-otter-123".
  // Leave empty to hide the "Join Octopus" box; the independence note always shows.
  referralUrl: "https://share.octopus.energy/silk-snail-210",

  // What each side gets. Octopus changes this now and then; update it here when they do.
  referralReward: "£50",

  // Region shown to first-time visitors (C = London). They can change it; the page remembers.
  defaultRegion: "C",

  // Anonymous, cookie-free visit and click counting with Umami (umami.is).
  // Paste the Website ID from your Umami dashboard; leave empty to turn analytics off.
  umamiWebsiteId: "3b273825-6d33-4f07-ae92-3d5da7163d83",

  // Ofgem price cap for single-rate electricity paid by Direct Debit (GB average).
  // Update every quarter from https://www.ofgem.gov.uk/energy-price-cap.
  // The cap line and the savings calculator hide themselves after "to".
  priceCap: {
    from: "2026-10-01",
    to: "2026-12-31",
    unitRate: 26.32,        // pence per kWh, GB average (no VAT on electricity 1 Oct 2026 to 31 Mar 2027)
    standingCharge: 54.83,  // pence per day, GB average
    label: "1 October to 31 December 2026",
    source: "https://www.ofgem.gov.uk/your-energy-supply/your-energy-bill/energy-price-cap-unit-rates-and-standing-charges",
  },
};
