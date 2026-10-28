# Satary

A personal futures charting, journaling, and backtesting prototype for MNQ, MES, and MGC.

## Run

Requires Node.js 22 or later. No dependency installation is needed.

```sh
npm run dev
```

The server listens on port 3000 (override with `PORT`). Run `npm test` to validate CSV parsing, indicator calculations, and strategy execution/cost accounting.

## Prototype capabilities

- Responsive chart workspace with contract switching, synthetic timeframes, candlesticks, volume, SMA 9/21, bar inspection, zoom, and navigation.
- Closed-trade journal persisted in browser localStorage, with gross contract P&L and CSV export. No cloud sync; export before clearing browser data.
- Long-only SMA crossover backtest using completed-bar signals and next-open fills, configurable commissions and slippage, and final-bar liquidation. Drawdown measures closed-trade equity, not intratrade risk.
- CSV import (up to 5 MB / 20,000 bars) for charting and backtesting. Required columns: `time,open,high,low,close`; optional `volume`. Use ISO 8601 UTC timestamps, unique ascending rows, and unquoted numeric fields. Imported data stays in memory, is not uploaded, and retains its original interval.

TradingView is the default market chart, embedded using its official Advanced Chart widget. MNQ, MES, and MGC use continuous-contract symbols CME_MINI:MNQ1!, CME_MINI:MES1!, and COMEX:MGC1!. Widget availability and quote delay depend on TradingView and exchange rules; this does not grant real-time subscriptions. The third-party widget loads from s3.tradingview.com and uses TradingView services. It does not share bars or prices with Satary. A direct link and Demo / imported CSV mode are available when the widget cannot load.

The market cards and local chart prices are deterministic synthetic examples or imported CSV data, not TradingView quotes. Timeframe selection generates a different synthetic series; it does not aggregate imported data. The embedded TradingView chart is separate from the local strategy data; no programmatic market-data feed is integrated. The Data library explains potential sources and limitations: free mini-contract proxies are not actual micro-contract data. Validate data licensing, contract rollover, exchange access, session boundaries, and provider coverage before adding feeds.

The journal excludes fees. Backtests model simple round-trip costs but do not model margin, rollover, liquidity, or order-book execution. Results are exploratory and do not establish future profitability.

## Implementation

Dependency-free browser modules and an SVG chart; small Node static server. Optional Google Fonts gracefully fall back to system fonts. Tests use the built-in Node runner. No API keys are required. TradingView mode requires access to TradingView’s third-party services; local chart, journal, and backtesting do not.
