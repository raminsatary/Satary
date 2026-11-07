export const instruments = {
  MNQ: { name: "Micro E-mini Nasdaq-100", base: 21480, tick: 0.25, point: 2 },
  MES: { name: "Micro E-mini S&P 500", base: 5890, tick: 0.25, point: 5 },
  MGC: { name: "Micro Gold", base: 2740, tick: 0.1, point: 10 },
};
export function sample(symbol = "MNQ", minutes = 5) {
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  let price = instruments[symbol].base;
  return Array.from({ length: 240 }, (_, i) => {
    const open = price;
    const move = (rand() - 0.47) * instruments[symbol].base * 0.0012;
    price =
      Math.round((open + move) / instruments[symbol].tick) *
      instruments[symbol].tick;
    return {
      time: Date.UTC(2026, 9, 27, 13, 30) + i * minutes * 60000,
      open,
      high: Math.max(open, price) + rand() * 8,
      low: Math.min(open, price) - rand() * 8,
      close: price,
      volume: Math.round(200 + rand() * 1800),
    };
  });
}
export function sma(bars, period) {
  let total = 0;
  return bars.map((bar, i) => {
    total += bar.close;
    if (i >= period) total -= bars[i - period].close;
    return i < period - 1 ? null : total / period;
  });
}
export function parseCSV(text) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim());
  const headers = lines
    .shift()
    .split(",")
    .map((s) => s.trim().toLowerCase());
  const fields = ["time", "open", "high", "low", "close"];
  if (
    new Set(headers).size !== headers.length ||
    !fields.every((k) => headers.includes(k))
  )
    throw Error(
      "Use unique time,open,high,low,close columns. Volume is optional.",
    );
  if (lines.length > 20000) throw Error("Import at most 20,000 bars.");
  const bars = lines.map((line, i) => {
    const cells = line.split(",").map((x) => x.trim());
    if (cells.length !== headers.length || cells.some((c) => !c))
      throw Error(`Row ${i + 2}: missing or extra values.`);
    const timestamp = cells[headers.indexOf("time")];
    if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(timestamp))
      throw Error(`Row ${i + 2}: use an ISO timestamp with timezone.`);
    const b = Object.fromEntries(
      headers.map((k, j) => [
        k,
        k === "time" ? Date.parse(cells[j]) : Number(cells[j]),
      ]),
    );
    b.volume = headers.includes("volume") ? b.volume : 0;
    if (
      !fields.every((k) => Number.isFinite(b[k])) ||
      !Number.isFinite(b.volume) ||
      b.volume < 0 ||
      fields.slice(1).some((k) => b[k] <= 0) ||
      b.low > Math.min(b.open, b.close) ||
      b.high < Math.max(b.open, b.close)
    )
      throw Error(`Row ${i + 2}: invalid timestamp, prices, or volume.`);
    return b;
  });
  if (bars.length < 3) throw Error("Import at least 3 bars.");
  if (bars.some((b, i) => i && b.time <= bars[i - 1].time))
    throw Error("Timestamps must be unique and ascending.");
  return bars;
}
export function tradePnl(t) {
  return (
    (t.exit - t.entry) *
      (t.direction === "Long" ? 1 : -1) *
      instruments[t.symbol].point *
      t.quantity -
    (Number(t.fees) || 0)
  );
}
export function performance(trades) {
  const values = trades.map((t) => t.pnl),
    wins = values.filter((v) => v > 0),
    losses = values.filter((v) => v < 0);
  let equity = 0,
    peak = 0,
    drawdown = 0;
  const curve = [0];
  for (const value of values) {
    equity += value;
    peak = Math.max(peak, equity);
    drawdown = Math.max(drawdown, peak - equity);
    curve.push(equity);
  }
  return {
    net: equity,
    drawdown,
    curve,
    winRate: values.length ? (wins.length / values.length) * 100 : 0,
    average: values.length ? equity / values.length : 0,
    profitFactor: losses.length
      ? wins.reduce((a, b) => a + b, 0) / -losses.reduce((a, b) => a + b, 0)
      : wins.length
        ? Infinity
        : null,
  };
}
export function backtest(
  bars,
  {
    fast = 9,
    slow = 21,
    point = 2,
    quantity = 1,
    commission = 1.24,
    slippage = 0.25,
    direction = "long",
  } = {},
) {
  if (!(
    fast >= 2 &&
    slow > fast &&
    Number.isInteger(fast) &&
    Number.isInteger(slow) &&
    Number.isInteger(quantity) &&
    quantity >= 1 &&
    Number.isFinite(point) &&
    point > 0 &&
    Number.isFinite(commission) &&
    commission >= 0 &&
    Number.isFinite(slippage) &&
    slippage >= 0 &&
    ["long", "short", "both"].includes(direction)
  ))
    throw Error(
      "Use whole MA periods with slow > fast, positive quantity, and nonnegative costs.",
    );
  if (bars.length < slow + 2) throw Error("Not enough bars for these periods.");
  const a = sma(bars, fast),
    b = sma(bars, slow);
  let position = null;
  const trades = [];
  const close = (price, time) => {
    const exit = price - position.side * slippage;
    trades.push({
      ...position,
      exit,
      exitTime: time,
      direction: position.side === 1 ? "Long" : "Short",
      pnl:
        ((exit - position.entry) * position.side * point - commission) *
        quantity,
    });
    position = null;
  };
  for (let i = slow; i < bars.length - 1; i++) {
    const bullish = a[i - 1] <= b[i - 1] && a[i] > b[i],
      bearish = a[i - 1] >= b[i - 1] && a[i] < b[i];
    if (!bullish && !bearish) continue;
    const side = bullish ? 1 : -1,
      next = bars[i + 1];
    if (position && position.side !== side) close(next.open, next.time);
    if (
      !position &&
      (direction === "both" || direction === (side === 1 ? "long" : "short"))
    )
      position = { entry: next.open + side * slippage, time: next.time, side };
  }
  if (position) close(bars.at(-1).close, bars.at(-1).time);
  return { trades, ...performance(trades) };
}
