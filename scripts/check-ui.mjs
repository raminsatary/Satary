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
const dom = new JSDOM(fs.readFileSync(root + "index.html", "utf8"), {
    url: "https://example.com/Satary/",
    runScripts: "outside-only",
  }),
  w = dom.window;
w.scrollTo = () => {};
w.structuredClone = structuredClone;
w.fetch = async () => ({
  ok: true,
  json: async () =>
    JSON.parse(fs.readFileSync(root + "data/briefing.json", "utf8")),
});
w.HTMLDialogElement.prototype.showModal = function () {
  this.open = true;
};
w.HTMLDialogElement.prototype.close = function () {
  this.open = false;
};
let downloads = 0;
w.URL.createObjectURL = () => {
  downloads++;
  return "blob:demo";
};
w.URL.revokeObjectURL = () => {};
w.HTMLAnchorElement.prototype.click = function () {};
w.eval(result.outputFiles[0].text);
const $ = (s) => w.document.querySelector(s),
  click = (s) => {
    assert.ok($(s), s);
    $(s).click();
  },
  submit = (s) =>
    $(s).dispatchEvent(new w.Event("submit", { cancelable: true }));
assert.match($("#page").textContent, /Your first trading workspace/);
click('[data-lesson="0"]');
assert.equal(JSON.parse(w.localStorage.getItem("satary-learning")).length, 1);
submit("#sizing-form");
assert.match($("#sizing-result").textContent, /whole contracts/);
click('[data-page="markets"]');
$("#market-search").value = "Apple";
$("#market-search").dispatchEvent(new w.Event("input"));
assert.equal(w.document.querySelectorAll("[data-research]").length, 1);
click('[data-research="AAPL"]');
assert.match($("#page").textContent, /AAPL/);
click('[data-page="practice"]');
$("#auto-advance-market").checked = false;
$("#auto-advance-market").dispatchEvent(new w.Event("change"));
assert.match($("#page").textContent, /AAPL/);
let form = $("#paper-order");
assert.equal(form.elements.price.disabled, true);
form.elements.stop.value = (+form.elements.price.value - 2).toFixed(2);
form.elements.target.value = (+form.elements.price.value + 4).toFixed(2);
submit("#paper-order");
assert.match($("#page").textContent, /working/);
click("#step-replay");
assert.match($("#page").textContent, /filled/);
assert.ok($("[data-close-position]"));
click("[data-close-position]");
assert.equal($("[data-close-position]"), null);
click('[data-go="journal"]');
assert.match($("#page").textContent, /Paper replay/);
assert.match($("#page").textContent, /Review by setup/);
assert.ok($("[data-edit]"));
click("[data-edit]");
$("#trade-form").elements.emotion.value = "Calm";
$("#trade-form").elements.rating.value = "4";
submit("#trade-form");
assert.match($("#page").textContent, /Calm/);
click('[data-page="practice"]');
$("#auto-advance-market").checked = false;
$("#auto-advance-market").dispatchEvent(new w.Event("change"));
click("#paper-export");
assert.equal(downloads, 1);
$("#practice-symbol").value = "MNQ";
$("#practice-symbol").dispatchEvent(new w.Event("change"));
form = $("#paper-order");
form.elements.side.value = "sell";
form.elements.side.dispatchEvent(new w.Event("change"));
form.elements.stop.value = (+form.elements.price.value + 40).toFixed(2);
form.elements.target.value = (+form.elements.price.value - 80).toFixed(2);
click("#chart-sell");
assert.match($("#page").textContent, /working/);
click("#step-replay");
assert.match($("#page").textContent, /filled/);
click("[data-close-position]");
click('[data-go="journal"]');
assert.equal(w.document.querySelectorAll("[data-edit]").length, 2);
click('[data-page="news"]');
await new Promise((r) => setTimeout(r, 0));
assert.match($("#intelligence-space").textContent, /Federal Reserve/);
assert.ok($(".brief-card"));
let scenarios = $("#scenario-form");
for (const [name, value] of Object.entries({
  bull: 50,
  base: 30,
  bear: 10,
  evidence: "Testing assumptions",
}))
  scenarios.elements.namedItem(name).value = value;
submit("#scenario-form");
assert.match($("#scenario-status").textContent, /total 90/);
scenarios.elements.bear.value = 20;
submit("#scenario-form");
assert.match($("#scenario-status").textContent, /Subjective scenarios saved/);
click('[data-page="calendar"]');
assert.ok($("#calendar-feed script"));
click('[data-page="backtest"]');
submit("#backtest-form");
assert.ok($("#results svg"));
click('[data-page="data"]');
assert.ok($("#csv"));
for (const route of [
  "start",
  "markets",
  "practice",
  "chart",
  "journal",
  "calendar",
  "news",
  "backtest",
  "data",
]) {
  $("#mobile-route").value = route;
  $("#mobile-route").dispatchEvent(new w.Event("change"));
  assert.equal(w.location.hash, "#" + route);
}
w.close();
console.log(
  "PASS: beginner path, sizing, market search/chart selection, long/short chart/ticket orders, replay fills, auto-journal, reviews, export, multi-source briefing, scenario validation, all nine routes.",
);
