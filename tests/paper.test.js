import test from "node:test";
import assert from "node:assert/strict";
import {
  newAccount,
  submitOrder,
  advanceAccount,
  closePosition,
  cancelOrder,
  modifyProtection,
  accountEquity,
  plannedRisk,
  rsi,
  vwap,
  baseRates,
} from "../src/paper.js";
import { tradePnl } from "../src/engine.js";
const time = Date.UTC(2026, 10, 6, 14),
  bar = (open = 100, high = 103, low = 99, close = 102) => ({
    time: time + 60000,
    open,
    high,
    low,
    close,
    volume: 100,
  });
const order = (more = {}) => ({
  symbol: "MNQ",
  side: "buy",
  type: "market",
  quantity: 2,
  stop: 95,
  target: 115,
  setup: "Breakout",
  ...more,
});
const queue = (s = newAccount(), more = {}) =>
  submitOrder(s, order(more), 100, 0, time);
test("market waits for a future bar, models fees, and journals a partial close", () => {
  let s = queue();
  assert.equal(advanceAccount(s, "MNQ", bar(), 0).positions.length, 0);
  s = advanceAccount(s, "MNQ", bar(), 1);
  assert.equal(s.positions[0].entry, 100.25);
  assert.equal(s.balance, 25000 - 1.24);
  assert.equal(accountEquity(s), 25000 - 1.24 + 7);
  s = closePosition(s, s.positions[0].id, 1, time + 60000);
  assert.equal(s.positions[0].quantity, 1);
  assert.equal(s.trades[0].fees, 1.24);
  assert.ok(Math.abs(s.trades[0].net - 1.76) < 1e-8);
  assert.ok(Math.abs(tradePnl(s.trades[0]) - s.trades[0].net) < 1e-8);
  s = closePosition(s, s.positions[0].id, 1, time + 60000);
  assert.equal(s.positions.length, 0);
  assert.ok(
    Math.abs(s.balance - (25000 + s.trades.reduce((n, t) => n + t.net, 0))) <
      1e-8,
  );
});
test("a short stop gaps at the open and both bracket touches favor the stop", () => {
  let s = queue(newAccount(), { side: "sell", stop: 105, target: 85 });
  s = advanceAccount(s, "MNQ", bar(), 1);
  assert.equal(s.positions[0].entry, 99.75);
  s = advanceAccount(
    s,
    "MNQ",
    { ...bar(108, 110, 80, 90), time: time + 120000 },
    2,
  );
  assert.equal(s.trades[0].exit, 108.25);
  assert.equal(s.trades[0].exitReason, "Stop loss");
});
test("limit fills respect the limit; unfilled limits remain working and can cancel", () => {
  let s = queue(newAccount(), { type: "limit", price: 98 });
  s = advanceAccount(s, "MNQ", bar(), 1);
  assert.equal(s.positions.length, 0);
  assert.equal(s.orders[0].status, "working");
  s = advanceAccount(s, "MNQ", bar(97, 100, 96, 99), 2);
  assert.equal(s.positions[0].entry, 97);
  const original = queue(newAccount(), { type: "limit", price: 98 });
  assert.equal(
    cancelOrder(original, original.orders[0].id).orders[0].status,
    "cancelled",
  );
  assert.equal(original.orders[0].status, "working");
});
test("stop entries activate at threshold plus slippage and reject a gap through the target", () => {
  let s = queue(newAccount(), { type: "stop", price: 104 });
  s = advanceAccount(s, "MNQ", bar(), 1);
  assert.equal(s.positions.length, 0);
  s = advanceAccount(s, "MNQ", bar(103, 106, 102, 105), 2);
  assert.equal(s.positions[0].entry, 104.25);
  let gap = queue();
  gap = advanceAccount(gap, "MNQ", bar(120, 122, 119, 121), 1);
  assert.equal(gap.orders[0].status, "rejected");
  assert.equal(gap.positions.length, 0);
});
test("bracket OCO closes once, even if both exit levels appear in the bar", () => {
  let s = queue();
  s = advanceAccount(s, "MNQ", bar(100, 116, 94, 102), 1);
  assert.equal(s.trades.length, 1);
  assert.equal(s.positions.length, 0);
  assert.equal(s.trades[0].exit, 94.75);
  assert.equal(s.trades[0].exitReason, "Stop loss");
});
test("risk limits, tick alignment, quantity and buying power are enforced", () => {
  assert.throws(() => queue(newAccount(), { quantity: 100 }), /risk/);
  assert.throws(() => queue(newAccount(), { quantity: 1.5 }));
  assert.throws(() => queue(newAccount(), { stop: 95.1 }), /tick/);
  assert.throws(() => queue(newAccount(), { side: "sell" }));
  const s = newAccount(1000);
  s.riskPercent = 5;
  assert.throws(() => queue(s, { quantity: 1 }), /buying power/);
  assert.equal(plannedRisk(newAccount(), order(), 100), 24.48);
});
test("daily realized loss lockout prevents new risk", () => {
  const s = newAccount();
  s.trades.push({ date: "2026-11-06", net: -750 });
  assert.throws(() => queue(s), /Daily/);
});
test("protection can tighten but cannot widen; invalid partial closes reject", () => {
  let s = advanceAccount(queue(), "MNQ", bar(), 1),
    id = s.positions[0].id;
  s = modifyProtection(s, id, 100.25, 116);
  assert.equal(s.positions[0].stop, 100.25);
  assert.throws(() => modifyProtection(s, id, 95, 116), /risk/);
  assert.throws(() => closePosition(s, id, 3, time));
  assert.throws(() => modifyProtection(s, id, 104, 116));
});
test("new account ids prevent duplicated journal ids after reset", () => {
  const a = closePosition(
    advanceAccount(queue(), "MNQ", bar(), 1),
    "position-2",
    1,
    time,
  );
  const b = closePosition(
    advanceAccount(queue(), "MNQ", bar(), 1),
    "position-2",
    1,
    time,
  );
  assert.notEqual(a.trades[0].id, b.trades[0].id);
});
test("RSI handles flat and monotonic samples; VWAP resets at UTC day boundary", () => {
  const rising = Array.from({ length: 20 }, (_, i) => ({ close: i + 1 }));
  assert.equal(rsi(rising).at(-1), 100);
  assert.equal(rsi(rising.map((b) => ({ close: 20 - b.close }))).at(-1), 0);
  assert.equal(rsi(rising.map(() => ({ close: 10 }))).at(-1), 50);
  assert.deepEqual(
    vwap([
      { time: 0, high: 10, low: 10, close: 10, volume: 2 },
      { time: 1, high: 20, low: 20, close: 20, volume: 2 },
      { time: 86400000, high: 30, low: 30, close: 30, volume: 1 },
    ]),
    [10, 15, 30],
  );
  const r = baseRates(rising, 5);
  assert.equal(r.count, 3);
  assert.equal(r.up, 3);
});
test("trailing protection tightens at close for the next bar and never widens", () => {
  let s = advanceAccount(
    queue(newAccount(), { trailTicks: 8 }),
    "MNQ",
    bar(),
    1,
  );
  assert.equal(s.positions[0].stop, 100);
  s = advanceAccount(s, "MNQ", bar(103, 106, 102, 105), 2);
  assert.equal(s.positions[0].stop, 103);
  assert.equal(s.trades.length, 0);
  s = advanceAccount(s, "MNQ", bar(102, 104, 101, 103), 3);
  assert.equal(s.trades[0].exit, 101.75);
});

test("pending orders reserve combined risk and buying power", () => {
  let s = newAccount();
  s.riskPercent = 1;
  s = queue(s, { quantity: 10 });
  assert.throws(() => queue(s, { quantity: 2 }), /Combined working-order risk/);
  let small = newAccount(2500);
  small.riskPercent = 5;
  small = queue(small, { quantity: 1 });
  assert.throws(() => queue(small, { quantity: 2 }), /buying power/);
});
test("filled working order is excluded from its own pending reservation", () => {
  let s = queue(newAccount(), { quantity: 2 });
  s = advanceAccount(s, "MNQ", bar(), 1);
  assert.equal(s.orders[0].status, "filled");
  assert.equal(s.positions.length, 1);
});
