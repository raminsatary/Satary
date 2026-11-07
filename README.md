# Satary — learn, observe, practice, reflect

A beginner-oriented market research and replay-trading workspace, hosted at https://raminsatary.github.io/Satary/.

## Run and verify

Node.js 22.12+ is required. The website has no runtime package dependencies and no build step. `npm run dev` starts the static server on port 3000 (`PORT` overrides it).

```sh
npm ci
npm test
npm run test:ui
npm run dev
```

Development dependencies are used only for DOM integration checks. The Node tests cover CSV parsing, indicators, backtest fills/costs, order eligibility, market/limit/stop fills, gap stops, conservative bracket exits, partial-close accounting, fees, risk limits, buying power, trailing protection, and unique journal IDs. The DOM check covers all nine routes, onboarding, sizing, market search, long/short replay orders, automatic journaling, reviews, exports, feed loading, and scenario validation. External iframe rendering and mobile appearance still require visual browser QA; the managed executor did not provide its supported browser tool.

## Workspaces

- **Start here (`#start`)**: a six-step learning path with primary-source links, locally saved completion, and a position-sizing calculator. The default homepage.
- **Market watch (`#markets`)**: external provider quotes and a searchable instrument picker. Supported replay instruments are MNQ, MES, MGC, MYM, M2K, AAPL, MSFT, NVDA, SPY, and QQQ. Futures use contract point values; stocks/ETFs use whole shares.
- **Demo trading (`#practice`)**: a $25,000 virtual replay account; market, limit, and stop entries; buy/sell buttons on the chart; chart-click ticket prices and horizontal levels; bracket OCO exits; adjustable protection, break-even stops, trailing stops, partial exits, order cancellation, fees, slippage, trade-risk caps, daily realized-loss caps, and simplified buying-power reserves. SMA/EMA, UTC-session VWAP, Bollinger bands, Wilder RSI, and Wilder ATR are available. Closed trades copy into the journal once. Account records can be exported as JSON.
- **Chart workspace (`#chart`)**: external TradingView charts or local synthetic/imported candlesticks with SMA overlays, inspection, zoom, and keyboard navigation. External charts support provider symbol search.
- **Trade journal (`#journal`)**: manual and automatically imported replay trades; editing, fees, setup/emotion/process ratings, initial price risk and R multiples, search, date/contract/direction/origin filters, net equity, drawdown, expectancy, setup breakdowns, and full CSV export. Editing/deleting a journal copy does not change simulator accounting.
- **Economic calendar (`#calendar`)**: external calendar with economy/importance filters and official BLS, BEA, and Federal Reserve schedule links.
- **News & briefing (`#news`)**: publisher RSS snapshots from the Federal Reserve, BLS, BEA, and BBC Business alongside TradingView headlines, conditional educational impact explanations, date-stamped personal notes, and a subjective scenario notebook.
- **Strategy lab (`#backtest`)**: SMA crossover research with long/short/bidirectional modes, completed-bar signals, next-open fills, final-close liquidation, fees/slippage, equity curves, profit factor, average trade, and results CSV export.
- **Data library (`#data`)**: CSV import, example downloads, source limitations, and links to data-provider information.

## Data and execution boundaries

**Provider market quotes do not drive simulated orders.** TradingView widgets are third-party displays; they do not share quotes or bars with Satary. Quotes can be delayed or unavailable depending on exchange permissions and provider coverage. No broker, licensed programmatic live feed, or real-money routing is connected. MNQ/MES/MGC are futures contracts; indexes, ETF shares, and futures are distinct instruments.

Replay uses deterministic synthetic bars by default, or selected imported CSV history. Synthetic baselines are examples, not current market prices. The replay reveals one completed bar at a time. Each instrument has its own clock; non-selected positions retain their latest replay mark. Orders cannot fill on their submission bar. Market/stop fills include adverse slippage; limits respect their price. If both bracket levels occur within one OHLC bar, the stop is taken first. A new intrabar entry conservatively permits an adverse stop but defers its target unless entered at the open. Trailing stops tighten after a completed bar and apply on the next bar.

Stops are required; practice protection can tighten but not widen. Default stop distance is the greater of 20 ticks and 1.5×ATR; this is a training preset, not a recommendation. Risk estimates include costs/slippage. Futures reserves use a configurable training value (default $1,000 per contract), **not broker/exchange margin**. Stock/ETF positions reserve full notional, including simplified shorts. Borrow costs, exchange queues, partial order fills, liquidation, overnight funding, rollover, and true intrabar paths are not modeled. Backtest drawdown uses closed-trade equity.

## Briefing sources and probabilities

`scripts/refresh-news.py` reads RSS directly from publishers, retaining source URLs and publication dates. Official-source excerpts and one BBC headline are displayed with rule-based context. Context is a conditional teaching framework, not an actual-versus-consensus calculation, individualized advice, or an AI-verified market forecast. Missing sources are marked unavailable. Snapshot fetch time is separate from article publication time; old snapshots show a freshness warning.

The scenario notebook stores the user's subjective bullish/range/bearish percentages with an explicit horizon and evidence; percentages must total 100. No default forecast is invented. Replay statistics are non-overlapping historical up/down frequencies in revealed synthetic/imported bars, labeled as descriptive frequencies rather than news-conditioned probabilities. No calibrated prediction model is connected.

The GitHub workflow (`.github/workflows/publish.yml`) runs checks, fetches RSS, saves updated snapshots, and requests an existing branch-based GitHub Pages build on main updates and hourly at minute 17 (GitHub may delay scheduled runs). It uses scoped repository contents-write and Pages-write permissions. If all sources fail, it retains the committed snapshot with its original timestamp. Existing Pages publishing remains **main / root**; no administrative hosting-mode change is required.

## Storage and imports

Learning progress, journal trades, replay account/tapes, dated briefing notes, and subjective scenarios are stored in this browser's localStorage. There is no sign-in or cloud synchronization. Exports are important before clearing browser data. Storage failure messages prompt exports; private browsing and browser quotas can prevent persistence. The JSON practice export is a portable record, not an implemented in-app restore mechanism.

CSV imports accept up to 5 MB / 20,000 bars with `time,open,high,low,close` and optional `volume`. Use unique ascending ISO timestamps with timezones, positive OHLC prices, unquoted numeric values, and nonnegative volume. Missing/extra fields, duplicate headers, and non-finite values are rejected. Imports retain their interval; timeframe buttons only affect synthetic charts. Imports stay in memory for chart/backtest use, while choosing an imported replay copies its bars into local account storage (at least 25 bars required). Check instrument mapping, licensing, sessions, corporate actions, and futures rollover conventions yourself.

## External services

TradingView widgets load scripts from `s3.tradingview.com` and use TradingView services. Google Fonts is optional and falls back to system fonts. Publisher feeds are fetched by GitHub Actions, not via an arbitrary browser CORS proxy. No secret keys are shipped in the static site.
