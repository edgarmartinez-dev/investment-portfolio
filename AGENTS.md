# Portfolio maintenance memory

Use these rules whenever the user asks to buy, sell, or otherwise adjust a
holding in this repository.

## Source of truth

- `data/holdings.json` is the only file to edit for a transaction.
- `shares` is the number of shares currently held.
- `invested` is the remaining cost basis, not the current market value.
- `cash` changes only when the user explicitly says the transaction is funded
  from, or credited to, the portfolio cash balance. Otherwise treat the money
  as entering or leaving externally and leave `cash` unchanged.
- Never hand-edit calculated value, daily change, or P&L fields in
  `data/portfolio.json` or `data/history.json`.

## Before a transaction

1. Run `node scripts/update-portfolio.mjs` to fetch a current quote.
2. Read the refreshed holding price from `data/portfolio.json`.
3. State the price and calculated share quantity used. This app records a
   portfolio transaction only; it does not place a brokerage order.

## Buy

For a purchase amount `A` at price `P`:

- `sharesBought = A / P`
- `newShares = oldShares + sharesBought`
- `newInvested = oldInvested + A`

Keep enough decimal precision in `shares` to represent a fractional-share
purchase accurately (normally 8 decimal places). If portfolio cash funds the
buy, also set `newCash = oldCash - A`; reject or clarify a cash-funded purchase
when the available cash is insufficient.

## Sell

For a sale specified in dollars `A` at price `P`, first calculate
`sharesSold = A / P`. For a sale specified in shares, use that quantity
directly. Do not sell more shares than are held.

Remove cost basis proportionally (average-cost method):

- `costBasisSold = oldInvested * (sharesSold / oldShares)`
- `newShares = oldShares - sharesSold`
- `newInvested = oldInvested - costBasisSold`

If all shares are sold, set both `shares` and `invested` to zero. If proceeds
are meant to remain as portfolio cash, increase `cash` by the sale proceeds;
otherwise leave `cash` unchanged. The current schema does not track realized
P&L separately, so mention this limitation when reporting a sale.

## Recalculate and verify

After editing `data/holdings.json`:

1. Run `node scripts/update-portfolio.mjs` again. This regenerates
   `data/portfolio.json` and today's entry in `data/history.json`.
2. Verify shares, cost basis, holding value, holding P&L, total value, total
   invested, and total P&L in the generated snapshot.
3. Confirm the JSON is valid and review `git diff` before committing.

## Push and deployment

- Commit `data/holdings.json`, `data/portfolio.json`, and `data/history.json`
  together.
- The scheduled GitHub workflow may update generated data while local work is
  in progress. Fetch and rebase onto `origin/main` before pushing.
- If generated files conflict during a rebase, keep the newest upstream
  generated versions, preserve the intended `data/holdings.json` transaction,
  rerun `node scripts/update-portfolio.mjs`, then continue the rebase.
- Push `main` to GitHub. DigitalOcean App Platform auto-deploys the repository
  at `https://walrus-app-27lq5.ondigitalocean.app`.
