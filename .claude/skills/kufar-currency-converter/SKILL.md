---
name: kufar-currency-converter
description: Context for the Kufar Currency Converter browser extension (Chrome MV3) that shows an informational USD equivalent under BYN prices on kufar.by. Use when working on this repo — manifest, content script, service worker, options page, NBRB rate handling, or questions about what the extension does and why it is lawful.
---

# Kufar Currency Converter

Chrome MV3 extension. Adds a read-only USD estimate under the BYN prices shown on `kufar.by` / `re.kufar.by`, in the user's own browser.

## Why it exists

In Belarus prices must be quoted and settled in BYN, so Kufar removed its USD display. Real-estate sellers still think in USD, so buyers mentally re-convert every listing. The extension does that arithmetic for them.

## Legality — non-negotiable design constraints

The extension is a personal viewing aid, not a pricing tool. Keep it that way:

- **BYN stays primary.** Never replace, hide, or overwrite the BYN price. USD is added as a separate, visually secondary line.
- **Informational only.** Label the USD figure as an approximation; it is never a price, an offer, or a settlement amount.
- **Official rate only.** Use the National Bank of the Republic of Belarus rate (`api.nbrb.by/exrates/rates/431`). No commercial, market, or user-invented rates.
- **Client-side only.** All rendering happens locally. No user data, browsing history, or listing data leaves the browser. No analytics, no third-party servers.
- **No interference with Kufar.** No scraping pipelines, no bulk requests, no bypassing auth, paywalls, or rate limits, no altering listings or outbound requests. Only DOM read + local DOM annotation on pages the user already opened.

Reject changes that break any of the above.

## Files

| File | Role |
|---|---|
| `manifest.json` | MV3 manifest; host permissions limited to kufar.by and api.nbrb.by |
| `content.js` | Finds BYN price nodes, injects the USD line, observes DOM changes |
| `background.js` | Service worker; fetches the NBRB rate (avoids page CORS), caches it in `chrome.storage.local` |
| `options.html` / `options.js` / `options.css` | Shows the current rate, manual refresh |
| `PRIVACY.md` | Privacy policy — must stay true to "no data collection" |

## Behaviour notes

- Rate cached in `chrome.storage.local` (`usdRate`, `lastUpdate`), refreshed after 24h.
- Fallback rate `3.25` used only when NBRB is unreachable; keep it clearly a fallback.
- Handles both total prices (`138 705 р.`) and per-square-meter prices (`3 278 р. за м²`).
- UI strings are Russian; keep new user-facing text in Russian.
