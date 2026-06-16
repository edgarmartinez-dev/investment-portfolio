// Fetches current prices for the configured holdings and writes:
//   data/portfolio.json  - latest snapshot the frontend reads
//   data/history.json    - one entry per calendar day (current day updated in place)
//
// Keyless: tries Yahoo Finance first, falls back to Stooq, then to the last
// known price from the previous snapshot. Run with: node scripts/update-portfolio.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const HOLDINGS = 'data/holdings.json';
const PORTFOLIO = 'data/portfolio.json';
const HISTORY = 'data/history.json';

const UA = 'Mozilla/5.0 (compatible; portfolio-bot/1.0)';

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch { return fallback; }
}

async function writeJson(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2) + '\n');
}

async function quoteYahoo(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`yahoo HTTP ${res.status}`);
  const json = await res.json();
  const meta = json?.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice;
  if (!price) throw new Error('yahoo: no price');
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
  return { price, prevClose };
}

async function quoteStooq(symbol) {
  const url = `https://stooq.com/q/l/?s=${symbol.toLowerCase()}.us&f=sd2t2ohlcv&h&e=csv`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`stooq HTTP ${res.status}`);
  const rows = (await res.text()).trim().split('\n');
  // header: Symbol,Date,Time,Open,High,Low,Close,Volume
  const c = rows[1].split(',');
  const close = parseFloat(c[6]);
  const open = parseFloat(c[3]);
  if (!Number.isFinite(close)) throw new Error('stooq: no close');
  return { price: close, prevClose: Number.isFinite(open) ? open : close };
}

async function getQuote(symbol, prev) {
  for (const [name, fn] of [['yahoo', quoteYahoo], ['stooq', quoteStooq]]) {
    try { return { ...(await fn(symbol)), source: name }; }
    catch (e) { console.warn(`[${symbol}] ${name} failed: ${e.message}`); }
  }
  if (prev && prev.price) {
    console.warn(`[${symbol}] using last known price`);
    return { price: prev.price, prevClose: prev.prevClose ?? prev.price, source: 'cached' };
  }
  throw new Error(`no quote available for ${symbol}`);
}

async function main() {
  const cfg = await readJson(HOLDINGS, null);
  if (!cfg) throw new Error(`missing ${HOLDINGS}`);
  const prevSnap = await readJson(PORTFOLIO, { holdings: [] });
  const prevBySym = Object.fromEntries((prevSnap.holdings || []).map((h) => [h.symbol, h]));

  let totalValue = 0, totalPrevValue = 0, totalInvested = 0;
  const holdings = [];

  for (const h of cfg.holdings) {
    const q = await getQuote(h.symbol, prevBySym[h.symbol]);
    const value = q.price * h.shares;
    const prevValue = q.prevClose * h.shares;
    const pl = value - h.invested;
    totalValue += value;
    totalPrevValue += prevValue;
    totalInvested += h.invested;
    holdings.push({
      symbol: h.symbol,
      name: h.name,
      exchange: h.exchange,
      shares: h.shares,
      invested: h.invested,
      price: round(q.price, 4),
      prevClose: round(q.prevClose, 4),
      value: round(value, 2),
      pl: round(pl, 2),
      plPct: h.invested ? round((pl / h.invested) * 100, 2) : 0,
      dayChange: round(value - prevValue, 2),
      dayChangePct: q.prevClose ? round(((q.price - q.prevClose) / q.prevClose) * 100, 2) : 0,
      source: q.source,
    });
  }

  const cash = cfg.cash || 0;
  const grandTotal = totalValue + cash;
  const todayChange = totalValue - totalPrevValue;
  const totalPL = totalValue - totalInvested;

  const snapshot = {
    updatedAt: new Date().toISOString(),
    currency: cfg.currency || 'USD',
    totalValue: round(grandTotal, 2),
    holdingsValue: round(totalValue, 2),
    cash,
    totalInvested: round(totalInvested, 2),
    today: {
      change: round(todayChange, 2),
      changePct: totalPrevValue ? round((todayChange / totalPrevValue) * 100, 2) : 0,
    },
    total: {
      change: round(totalPL, 2),
      changePct: totalInvested ? round((totalPL / totalInvested) * 100, 2) : 0,
    },
    holdings,
  };
  await writeJson(PORTFOLIO, snapshot);

  // Daily history: replace today's entry if it exists, otherwise append.
  const history = await readJson(HISTORY, []);
  const date = snapshot.updatedAt.slice(0, 10);
  const entry = {
    date,
    updatedAt: snapshot.updatedAt,
    totalValue: snapshot.totalValue,
    totalInvested: snapshot.totalInvested,
    totalPL: snapshot.total.change,
    holdings: Object.fromEntries(
      holdings.map((h) => [h.symbol, { price: h.price, value: h.value, pl: h.pl, shares: h.shares }])
    ),
  };
  const idx = history.findIndex((e) => e.date === date);
  if (idx >= 0) history[idx] = entry; else history.push(entry);
  await writeJson(HISTORY, history);

  console.log(`Updated: total $${snapshot.totalValue}  today ${snapshot.today.change}  P&L ${snapshot.total.change}`);
}

function round(n, d) { const f = 10 ** d; return Math.round(n * f) / f; }

main().catch((e) => { console.error(e); process.exit(1); });
