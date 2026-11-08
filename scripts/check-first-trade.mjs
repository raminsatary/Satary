import { build } from "esbuild";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import assert from "node:assert/strict";
const root = new URL("../", import.meta.url).pathname;
const result = await build({
  entryPoints: [root + "src/app.js"],
  bundle: true,
  format: "iife",
  write: false,
});
function fixture(snapshot) {
  const dom = new JSDOM(fs.readFileSync(root + "index.html", "utf8"), {
      url: "https://example.com/Satary/",
      runScripts: "outside-only",
    }),
    w = dom.window;
  w.scrollTo = () => {};
  w.structuredClone = structuredClone;
  w.fetch = async () => ({ ok: false });
  if (snapshot)
    w.localStorage.setItem("satary-paper-v1", JSON.stringify(snapshot));
  w.eval(result.outputFiles[0].text);
  const $ = (s) => w.document.querySelector(s);
  return {
    dom,
    w,
    $,
    account: () =>
      JSON.parse(w.localStorage.getItem("satary-paper-v1") || "null")?.account,
    close: () => w.close(),
  };
}
for (const symbol of [
  "MNQ",
  "MES",
  "MGC",
  "MYM",
  "M2K",
  "AAPL",
  "MSFT",
  "NVDA",
  "SPY",
  "QQQ",
])
  for (const side of ["buy", "sell"]) {
    const f = fixture();
    f.$('.welcome-actions [data-go="practice"]').click();
    assert.ok(f.$("#paper-order"));
    f.$("#practice-symbol").value = symbol;
    f.$("#practice-symbol").dispatchEvent(new f.w.Event("change"));
    assert.equal(
      f.$("#paper-order").reportValidity(),
      true,
      `${symbol} defaults must pass native input validation`,
    );
    const initialTime = f.$(".chart-title p").textContent;
    if (side === "buy") f.$("#paper-order").requestSubmit();
    else f.$("#chart-sell").click();
    assert.equal(
      f.account().orders.at(-1).status,
      "filled",
      `${symbol} ${side} default first order should fill`,
    );
    assert.match(f.$("#practice-status").textContent, /filled/);
    assert.equal(f.$("#practice-feedback").hidden, false);
    assert.notEqual(f.$(".chart-title p").textContent, initialTime);
    assert.ok(f.$("[data-close-position]"));
    f.$("[data-close-position]").click();
    assert.match(f.$("#practice-status").textContent, /Added to your journal/);
    f.$("#log-trade").click();
    assert.match(f.$("#page").textContent, /Paper replay/);
    assert.ok(f.$("[data-edit]"));
    f.close();
  }
{
  const f = fixture();
  f.$("#log-trade").click();
  assert.ok(
    f.$("#paper-order"),
    "homepage primary action must open demo trading, not manual journal",
  );
  f.$("#auto-advance-market").click();
  f.$("#chart-buy").click();
  assert.equal(f.account().orders[0].status, "working");
  assert.match(f.$("#practice-status").textContent, /Advance next bar/);
  f.$("#feedback-step").click();
  assert.equal(f.account().orders[0].status, "filled");
  f.close();
}
{
  const f = fixture();
  f.$("#log-trade").click();
  const form = f.$("#paper-order");
  form.elements.type.value = "limit";
  form.dispatchEvent(new f.w.Event("input"));
  form.elements.price.value = Number(form.elements.price.value) - 2.5;
  form.requestSubmit();
  assert.equal(
    f.account().orders[0].status,
    "working",
    "limit orders must wait for a price condition",
  );
  assert.equal(f.account().positions.length, 0);
  assert.match(f.$("#practice-status").textContent, /entry price is reached/);
  f.close();
}
{
  const f = fixture();
  f.$("#log-trade").click();
  f.$("#paper-order").elements.quantity.value = 100;
  f.$("#chart-buy").click();
  assert.equal(f.account(), undefined);
  assert.equal(f.$("#practice-feedback").hidden, false);
  assert.match(f.$("#practice-status").textContent, /risk/);
  f.$("#paper-order").elements.quantity.value = 1.5;
  f.$("#chart-buy").click();
  assert.match(f.$("#practice-status").textContent, /Quantity/);
  assert.equal(f.$("#paper-order").elements.quantity.value, "1.5");
  f.close();
}
{
  const f = fixture();
  f.$("#log-trade").click();
  f.$("#chart-buy").click();
  f.$("[data-close-position]").click();
  const snapshot = JSON.parse(f.w.localStorage.getItem("satary-paper-v1"));
  snapshot.account.fees = 0;
  snapshot.account.slipTicks = 0;
  const originalId = snapshot.account.id;
  f.close();
  const restored = fixture(snapshot);
  restored.$("#log-trade").click();
  restored.$("#chart-buy").click();
  assert.equal(
    restored.account().id,
    originalId,
    "a valid zero-cost practice account must survive reload",
  );
  assert.equal(restored.account().fees, 0);
  assert.equal(restored.account().slipTicks, 0);
  assert.equal(restored.account().trades.length, 1);
  restored.close();
}
console.log(
  "PASS: fresh Start Here → default buy/sell → fill → close → journal for all 10 instruments; primary CTA, manual replay mode, pending limit, visible errors, and zero-cost account reload.",
);
