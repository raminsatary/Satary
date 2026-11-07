import test from "node:test";
import assert from "node:assert/strict";
import { sample, parseCSV, backtest, sma, instruments } from "../src/engine.js";
test("demo bars are deterministic and valid for all contracts", () => {
  for (const s of Object.keys(instruments)) {
    const b = sample(s);
    assert.deepEqual(b, sample(s));
    assert.equal(b.length, 240);
    assert.ok(
      b.every(
        (v) =>
          v.low <= Math.min(v.open, v.close) &&
          v.high >= Math.max(v.open, v.close),
      ),
    );
  }
});
test("CSV validates price ranges and ordering", () => {
  const h = "time,open,high,low,close\n",
    v =
      "2026-01-01T00:00:00Z,10,12,9,11\n2026-01-01T00:05:00Z,11,13,10,12\n2026-01-01T00:10:00Z,12,14,11,13";
  assert.equal(parseCSV(h + v).length, 3);
  assert.throws(() => parseCSV(h + v.replace(",10,12,9,11", ",10,8,9,11")));
  assert.throws(() => parseCSV(h + v.replace("00:05:00", "00:00:00")));
});
test("SMA warmup and arithmetic", () =>
  assert.deepEqual(sma([{ close: 1 }, { close: 3 }, { close: 5 }], 2), [
    null,
    2,
    4,
  ]));
test("backtest fills at next open and applies costs", () => {
  const b = [5, 4, 3, 2, 5, 6, 7, 2, 1, 2].map((close, i) => ({
    close,
    open: 100 + i,
    time: i,
  }));
  const r = backtest(b, {
    fast: 2,
    slow: 3,
    point: 2,
    quantity: 2,
    commission: 1,
    slippage: 0.25,
  });
  assert.equal(r.trades.length, 1);
  assert.equal(r.trades[0].entry, 105.25);
  assert.equal(r.trades[0].exit, 107.75);
  assert.equal(r.net, 8);
});
test("costs reduce returns; empty results and invalid periods handled", () => {
  const b = sample();
  assert.ok(
    backtest(b, { commission: 10, slippage: 1 }).net <
      backtest(b, { commission: 0, slippage: 0 }).net,
  );
  assert.equal(
    backtest(
      Array.from({ length: 40 }, (_, i) => ({ open: 10, close: 10, time: i })),
    ).trades.length,
    0,
  );
  assert.throws(() => backtest(b, { fast: 21, slow: 9 }));
});
test("CSV rejects missing prices, non-finite volume, duplicate columns and timezone-free dates", () => {
  const h = "time,open,high,low,close,volume\n";
  const rows = [
    "2026-01-01T00:00:00Z,10,12,9,11,3",
    "2026-01-01T00:05:00Z,11,13,10,12,4",
    "2026-01-01T00:10:00Z,12,14,11,13,5",
  ].join("\n");
  for (const bad of [
    rows.replace(",10,12,9", ",,12,9"),
    rows.replace(",11,3", ",11,NaN"),
    rows.replace("00:00:00Z", "00:00:00"),
    rows.replace(",10,12,9", ",0,12,9"),
  ])
    assert.throws(() => parseCSV(h + bad));
  assert.throws(() => parseCSV(h.replace("volume", "close") + rows));
  assert.equal(parseCSV("\uFEFF" + h + rows + "\n\n").length, 3);
});
test("short fills and reversals apply side-aware costs at next open", () => {
  const bars = [5, 4, 3, 2, 5, 6, 7, 2, 1, 2, 6, 7].map((close, i) => ({
    open: 100 + i,
    close,
    time: i,
  }));
  const short = backtest(bars, {
    fast: 2,
    slow: 3,
    direction: "short",
    point: 2,
    quantity: 2,
    commission: 1,
    slippage: 0.25,
  });
  assert.equal(short.trades[0].entry, 107.75);
  assert.equal(short.trades[0].exit, 111.25);
  assert.equal(short.trades[0].pnl, -16);
  assert.equal(short.trades[0].exitTime, 11);
  const both = backtest(bars, {
    fast: 2,
    slow: 3,
    direction: "both",
    slippage: 0,
    commission: 0,
  });
  assert.deepEqual(
    both.trades.map((t) => t.direction),
    ["Long", "Short", "Long"],
  );
  assert.equal(both.trades[0].exitTime, both.trades[1].time);
  for (const settings of [
    { quantity: 1.5 },
    { point: Infinity },
    { commission: Infinity },
    { slippage: NaN },
    { direction: "invalid" },
  ])
    assert.throws(() => backtest(bars, { fast: 2, slow: 3, ...settings }));
});
test("journal fees and closed-equity metrics include losses from starting equity", async () => {
  const { tradePnl, performance } = await import("../src/engine.js");
  assert.equal(
    tradePnl({
      symbol: "MES",
      entry: 100,
      exit: 102,
      direction: "Long",
      quantity: 2,
      fees: 3,
    }),
    17,
  );
  assert.equal(
    tradePnl({
      symbol: "MNQ",
      entry: 100,
      exit: 102,
      direction: "Short",
      quantity: 1,
    }),
    -4,
  );
  const r = performance([{ pnl: -10 }, { pnl: 30 }, { pnl: -5 }]);
  assert.equal(r.net, 15);
  assert.equal(r.drawdown, 10);
  assert.equal(r.profitFactor, 2);
  assert.deepEqual(r.curve, [0, -10, 20, 15]);
});
