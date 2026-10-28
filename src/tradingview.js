// Official TradingView Advanced Chart widget. The embedded chart owns its data;
// no quote or candle values are read back into Satary.
export const tradingViewSymbols = {
  MNQ: 'CME_MINI:MNQ1!',
  MES: 'CME_MINI:MES1!',
  MGC: 'COMEX:MGC1!',
};
export function mountTradingView(host, symbol, onError) {
  const widget = document.createElement('div');
  widget.className = 'tradingview-widget-container';
  const chart = document.createElement('div');
  chart.className = 'tradingview-widget-container__widget';
  widget.append(chart);
  const attribution = document.createElement('div');
  attribution.className = 'tradingview-widget-copyright';
  const link = document.createElement('a');
  link.href = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tradingViewSymbols[symbol])}`;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = `${symbol} charts by TradingView`;
  attribution.append(link);
  widget.append(attribution);
  const script = document.createElement('script');
  script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
  script.async = true;
  script.textContent = JSON.stringify({
    autosize: true,
    symbol: tradingViewSymbols[symbol],
    interval: '5',
    timezone: 'Etc/UTC',
    theme: 'light',
    style: '1',
    locale: 'en',
    allow_symbol_change: true,
    calendar: false,
    support_host: 'https://www.tradingview.com',
  });
  script.onerror = () => { if(host.isConnected) onError(); };
  widget.append(script);
  host.replaceChildren(widget);
}
