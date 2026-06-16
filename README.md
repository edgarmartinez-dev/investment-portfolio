# Investment Portfolio UI

A single-file, pixel-faithful HTML/CSS recreation of a mobile investment
portfolio screen — holdings, P&L, cash balances and a Trade action — built to
match a reference design 1:1. No build step, no dependencies.

## Preview

Open `index.html` in any browser. It is sized for a ~430px-wide mobile viewport
(centered on larger screens).

## Install (PWA)

This is an installable Progressive Web App. Because service workers require a
secure context, serve it over HTTPS (e.g. GitHub Pages) or `localhost`:

```bash
python3 -m http.server 8000
# then open http://127.0.0.1:8000/
```

- **Desktop Chrome/Edge:** click the install icon in the address bar.
- **iOS Safari:** Share → "Add to Home Screen".
- **Android Chrome:** menu → "Install app".

It works offline after the first load (assets are cached by `sw.js`).

## Live data

Prices are pulled from a **keyless** source (Yahoo Finance, with Stooq as a
fallback — no API key or secret needed). A GitHub Actions cron job runs
`scripts/update-portfolio.mjs` ~hourly and commits the results, which
DigitalOcean then auto-deploys. The frontend reads `data/portfolio.json` on
load (and falls back to the static placeholder values if it's unavailable).

Data files:

- `data/holdings.json` — **your editable config**: shares, cost basis
  (`invested`), and cash. This is the source of truth.
- `data/portfolio.json` — generated snapshot the UI reads (current prices,
  values, day change, total P&L).
- `data/history.json` — one entry per day (the current day is updated in place),
  for charting value over time.

### Editing your portfolio

Edit `data/holdings.json`:

- **`shares`** — number of shares held.
- **`invested`** — total amount you paid (cost basis) for that holding.
- **`cash`** — cash balance.

To record a buy/sell, adjust `shares` and `invested` accordingly (e.g. buying
$1,000 more: add the shares bought and add `1000` to `invested`; selling:
reduce both). Total P&L is `current value − invested`.

The **refresh button** in the app re-pulls the latest committed snapshot from
the server (it does not call any external API). To force a brand-new price pull,
trigger the workflow (see below) — scheduled runs are best-effort, so a manual
run is the way to get fresh data on demand.

### Running the updater manually

```bash
node scripts/update-portfolio.mjs   # Node 18+
```

Or trigger the workflow from the GitHub **Actions** tab (“Update portfolio
data” → Run workflow). To swap to a keyed provider (e.g. Finnhub) for higher
reliability, replace the `quoteYahoo`/`quoteStooq` functions and add the key as
a repo secret referenced in the workflow.

## Features

- Single self-contained `index.html` — icons, flag, and Trade button are PNGs
  cut from the reference and embedded as base64 (no external image requests).
- Installable PWA: web manifest, service worker, and app icons (incl. maskable).
- Portfolio value header with Today / Total performance.
- Holdings table (TSLA, VOO) with sortable column indicators.
- Cash balances row with USD flag and quick actions.
- Floating Trade button.

## License

MIT
