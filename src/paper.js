import { instruments } from "./engine.js";
const copy = (s) => structuredClone(s);
export function newAccount(balance = 25000) {
  if (!Number.isFinite(balance) || balance <= 0)
    throw Error("Choose a positive practice balance.");
  return {
    version: 1,
    id: crypto.randomUUID(),
    initial: balance,
    balance,
    orders: [],
    positions: [],
    trades: [],
    sequence: 0,
    fees: 0.62,
    slipTicks: 1,
    riskPercent: 1,
    dailyLossPercent: 3,
    marginPerContract: 1000,
  };
}
export function accountEquity(s, marks = {}) {
  return (
    s.balance +
    s.positions.reduce(
      (sum, p) =>
        sum +
        ((marks[p.symbol] ?? p.mark) - p.entry) *
          p.side *
          instruments[p.symbol].point *
          p.quantity,
      0,
    )
  );
}
export function plannedRisk(s, spec, price) {
  const info = instruments[spec.symbol];
  return (
    (Math.abs(price - spec.stop) * info.point +
      2 * s.fees +
      2 * s.slipTicks * info.tick * info.point) *
    spec.quantity
  );
}
function check(s, o, price, time) {
  const i = instruments[o.symbol];
  if (
    !i ||
    !["buy", "sell"].includes(o.side) ||
    !["market", "limit", "stop"].includes(o.type) ||
    !Number.isInteger(o.quantity) ||
    o.quantity < 1 ||
    o.quantity > 10000 ||
    ![price, o.stop, o.target].every((v) => Number.isFinite(v) && v > 0)
  )
    throw Error(
      "Use a supported instrument, whole quantity, and positive prices for entry, stop, and target.",
    );
  if (
    o.trailTicks !== undefined &&
    (!Number.isInteger(o.trailTicks) || o.trailTicks < 0)
  )
    throw Error("Trailing distance must be whole nonnegative ticks.");
  const sign = o.side === "buy" ? 1 : -1;
  if ((price - o.stop) * sign <= 0 || (o.target - price) * sign <= 0)
    throw Error(
      "For buys: stop < entry < target. For sells: target < entry < stop.",
    );
  for (const value of [
    o.stop,
    o.target,
    ...(o.type === "market" ? [] : [o.price]),
  ])
    if (
      !Number.isFinite(value) ||
      Math.abs(value / i.tick - Math.round(value / i.tick)) > 1e-5
    )
      throw Error(`Prices must follow the ${i.tick} tick size.`);
  const equity = accountEquity(s);
  if (plannedRisk(s, o, price) > (equity * s.riskPercent) / 100)
    throw Error(
      `Planned risk exceeds your ${s.riskPercent}% account limit. Reduce quantity or stop distance.`,
    );
  const day = new Date(time).toISOString().slice(0, 10),
    net = s.trades
      .filter((t) => t.date === day)
      .reduce((sum, t) => sum + t.net, 0);
  if (net <= (-s.initial * s.dailyLossPercent) / 100)
    throw Error(
      "Daily realized loss limit reached. Review your journal before the next session.",
    );
  const reserve = (symbol, quantity, mark) =>
    instruments[symbol].kind === "stock" || instruments[symbol].kind === "etf"
      ? quantity * mark
      : quantity * s.marginPerContract;
  const used = s.positions.reduce(
    (n, p) => n + reserve(p.symbol, p.quantity, p.mark),
    0,
  );
  if (
    used + reserve(o.symbol, o.quantity, price) + s.fees * o.quantity >
    equity
  )
    throw Error(
      "Insufficient simulated buying power. Futures use the training margin setting; stocks reserve their full value.",
    );
}
export function submitOrder(state, spec, mark, index, time) {
  const s = copy(state);
  if (s.orders.filter((o) => o.status === "working").length >= 20)
    throw Error(
      "Cancel an existing order before adding more than 20 working orders.",
    );
  const price = spec.type === "market" ? mark : spec.price;
  check(s, spec, price, time);
  s.orders.push({
    ...spec,
    id: "order-" + ++s.sequence,
    status: "working",
    submittedIndex: index,
    submittedAt: time,
  });
  return s;
}
export function cancelOrder(state, id) {
  const s = copy(state),
    o = s.orders.find((o) => o.id === id && o.status === "working");
  if (!o) throw Error("This order is no longer working.");
  o.status = "cancelled";
  return s;
}
function exitPosition(s, p, quantity, price, time, reason) {
  const fees = s.fees * quantity,
    entryFees = (p.entryFees * quantity) / p.quantity;
  const gross =
    (price - p.entry) * p.side * instruments[p.symbol].point * quantity;
  s.balance += gross - fees;
  const t = {
    id: "paper-" + s.id + "-" + ++s.sequence,
    symbol: p.symbol,
    direction: p.side === 1 ? "Long" : "Short",
    entry: p.entry,
    exit: price,
    quantity,
    fees: entryFees + fees,
    net: gross - entryFees - fees,
    date: new Date(time).toISOString().slice(0, 10),
    entryTime: p.time,
    exitTime: time,
    initialRisk:
      Math.abs(p.entry - p.initialStop) *
      instruments[p.symbol].point *
      quantity,
    setup: p.setup || "Practice",
    emotion: "",
    rating: "",
    notes: p.notes || "",
    source: "Paper replay",
    exitReason: reason,
  };
  s.trades.push(t);
  p.quantity -= quantity;
  p.entryFees -= entryFees;
  if (!p.quantity) s.positions = s.positions.filter((v) => v.id !== p.id);
}
export function closePosition(state, id, quantity, time) {
  const s = copy(state),
    p = s.positions.find((p) => p.id === id);
  if (
    !p ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > p.quantity
  )
    throw Error("Choose a valid open position quantity.");
  exitPosition(
    s,
    p,
    quantity,
    p.mark - p.side * s.slipTicks * instruments[p.symbol].tick,
    time,
    "Manual close",
  );
  return s;
}
export function modifyProtection(state, id, stop, target) {
  const s = copy(state),
    p = s.positions.find((p) => p.id === id);
  if (!p) throw Error("Position is closed.");
  const i = instruments[p.symbol];
  if (
    ![stop, target].every(
      (v) =>
        Number.isFinite(v) &&
        v > 0 &&
        Math.abs(v / i.tick - Math.round(v / i.tick)) < 1e-5,
    ) ||
    (p.mark - stop) * p.side <= 0 ||
    (target - p.mark) * p.side <= 0
  )
    throw Error("Use tick-aligned protection around the current price.");
  if ((p.entry - stop) * p.side > (p.entry - p.stop) * p.side)
    throw Error(
      "Practice rule: protection may tighten, but initial risk cannot be increased.",
    );
  p.stop = stop;
  p.target = target;
  return s;
}
function protect(s, p, bar, allowTarget = true) {
  const info = instruments[p.symbol];
  let price, reason;
  if (p.side === 1 ? bar.low <= p.stop : bar.high >= p.stop) {
    price =
      (p.side === 1 ? Math.min(bar.open, p.stop) : Math.max(bar.open, p.stop)) -
      p.side * s.slipTicks * info.tick;
    reason = "Stop loss";
  } else if (
    allowTarget &&
    (p.side === 1 ? bar.high >= p.target : bar.low <= p.target)
  ) {
    price =
      p.side === 1
        ? Math.max(bar.open, p.target)
        : Math.min(bar.open, p.target);
    reason = "Take profit";
  }
  if (reason) exitPosition(s, p, p.quantity, price, bar.time, reason);
}
export function advanceAccount(state, symbol, bar, index) {
  const s = copy(state),
    info = instruments[symbol];
  if (
    !info ||
    ![bar.open, bar.high, bar.low, bar.close, bar.time].every(
      Number.isFinite,
    ) ||
    bar.low > Math.min(bar.open, bar.close) ||
    bar.high < Math.max(bar.open, bar.close)
  )
    throw Error("Invalid replay bar.");
  for (const p of [...s.positions].filter((p) => p.symbol === symbol)) {
    p.mark = bar.open;
    protect(s, p, bar);
    if (s.positions.includes(p)) {
      p.mark = bar.close;
      trail(p, info);
    }
  }
  for (const o of s.orders.filter(
    (o) =>
      o.status === "working" && o.symbol === symbol && o.submittedIndex < index,
  )) {
    let price;
    const sign = o.side === "buy" ? 1 : -1;
    if (o.type === "market") price = bar.open + sign * s.slipTicks * info.tick;
    if (
      o.type === "limit" &&
      (sign === 1 ? bar.low <= o.price : bar.high >= o.price)
    )
      price =
        sign === 1 ? Math.min(bar.open, o.price) : Math.max(bar.open, o.price);
    if (
      o.type === "stop" &&
      (sign === 1 ? bar.high >= o.price : bar.low <= o.price)
    )
      price =
        (sign === 1
          ? Math.max(bar.open, o.price)
          : Math.min(bar.open, o.price)) +
        sign * s.slipTicks * info.tick;
    if (price === undefined) continue;
    try {
      check(s, o, price, bar.time);
    } catch (e) {
      o.status = "rejected";
      o.reason = e.message;
      continue;
    }
    const fee = s.fees * o.quantity;
    s.balance -= fee;
    o.status = "filled";
    o.fill = price;
    o.fillTime = bar.time;
    const p = {
      id: "position-" + ++s.sequence,
      symbol,
      entry: price,
      mark: bar.close,
      side: sign,
      quantity: o.quantity,
      stop: o.stop,
      initialStop: o.stop,
      target: o.target,
      entryFees: fee,
      time: bar.time,
      setup: o.setup,
      notes: o.notes,
      trailTicks: o.trailTicks || 0,
    };
    s.positions.push(p);
    // OHLC has no intrabar path: adverse stop takes priority; non-open entries defer targets.
    protect(
      s,
      p,
      { ...bar, open: price },
      o.type === "market" ||
        (sign === 1 ? bar.open <= o.price : bar.open >= o.price),
    );
    if (s.positions.includes(p)) trail(p, info);
  }
  return s;
}
function trail(p, info) {
  if (!p.trailTicks) return;
  const stop =
    Math.round((p.mark - p.side * p.trailTicks * info.tick) / info.tick) *
    info.tick;
  if ((stop - p.stop) * p.side > 0) p.stop = stop;
}
export function ema(bars, period) {
  const k = 2 / (period + 1);
  let value = bars[0]?.close;
  return bars.map((b) => (value = b.close * k + value * (1 - k)));
}
export function rsi(bars, period = 14) {
  let up = 0,
    down = 0;
  return bars.map((bar, i) => {
    if (i === 0) return null;
    const delta = bar.close - bars[i - 1].close;
    if (i <= period) {
      up += Math.max(0, delta) / period;
      down += Math.max(0, -delta) / period;
    } else {
      up = (up * (period - 1) + Math.max(0, delta)) / period;
      down = (down * (period - 1) + Math.max(0, -delta)) / period;
    }
    return i < period ? null : up + down === 0 ? 50 : (100 * up) / (up + down);
  });
}
export function vwap(bars) {
  let pv = 0,
    volume = 0,
    day = "";
  return bars.map((b) => {
    const date = new Date(b.time).toISOString().slice(0, 10);
    if (day !== date) {
      pv = 0;
      volume = 0;
      day = date;
    }
    pv += ((b.high + b.low + b.close) / 3) * b.volume;
    volume += b.volume;
    return volume ? pv / volume : null;
  });
}
export function atr(bars, period = 14) {
  let value = 0;
  return bars.map((bar, i) => {
    const prev = bars[i - 1]?.close ?? bar.open,
      tr = Math.max(
        bar.high - bar.low,
        Math.abs(bar.high - prev),
        Math.abs(bar.low - prev),
      );
    value =
      i < period ? value + tr / period : (value * (period - 1) + tr) / period;
    return i < period - 1 ? null : value;
  });
}
export function baseRates(bars, horizon = 5) {
  const returns = [];
  for (let i = 0; i + horizon < bars.length; i += horizon)
    returns.push((bars[i + horizon].close / bars[i].close - 1) * 100);
  return {
    count: returns.length,
    up: returns.filter((v) => v > 0).length,
    down: returns.filter((v) => v < 0).length,
    flat: returns.filter((v) => v === 0).length,
    horizon,
  };
}
