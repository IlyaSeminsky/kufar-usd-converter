# Privacy Policy — Kufar Currency Converter

_Last updated: 2026-08-21_

Kufar Currency Converter is a free, open-source browser extension. This page
describes what data it accesses and what it does with it.

## What the extension does

The extension reads the Belarusian ruble (BYN) prices shown on kufar.by
listing and search pages and displays an additional estimated price in US
dollars next to them, using the official exchange rate published by the
National Bank of the Republic of Belarus.

## Data the extension accesses

- **Page content on kufar.by**: the extension reads price text already
  visible on the page (e.g. `138 705 р.`) in order to compute and display
  the USD equivalent. It does not read, collect, or transmit any other page
  content — no personal data, messages, contact details, or account
  information.
- **Exchange rate data**: the extension fetches the current USD/BYN rate
  from the National Bank of the Republic of Belarus public API
  (`api.nbrb.by/exrates/rates/431`). This is a public, unauthenticated
  endpoint; no identifying information is sent with the request.

## Data the extension stores

The extension stores exactly two values in the browser's local extension
storage (`chrome.storage.local`), which stays on your device and is never
sent anywhere by the extension itself:

- the last fetched USD/BYN exchange rate, and
- the timestamp of when it was fetched.

This cache is used to avoid calling the National Bank's API on every page
load; it refreshes automatically after 24 hours, or immediately if you use
the "Refresh rate" button on the extension's options page.

## Data the extension does NOT do

- It does not collect, transmit, or sell any personal data.
- It does not use analytics, tracking pixels, or third-party scripts.
- It does not require or use any account, login, or authentication.
- It does not communicate with any server other than kufar.by (to read page
  content) and api.nbrb.by (to fetch the exchange rate).

## Permissions explained

| Permission | Why it's needed |
|---|---|
| `storage` | Cache the exchange rate locally to avoid repeated network requests. |
| Host access to `kufar.by` | Read visible BYN prices on the page to display a USD equivalent next to them. |
| Host access to `api.nbrb.by` | Fetch the official USD/BYN exchange rate. |

## Changes to this policy

If this policy changes, the update will be reflected on this page with a
new "Last updated" date.

## Contact

For questions about this extension, open an issue on the project's GitHub
repository: https://github.com/IlyaSeminsky/kufar-usd-converter
