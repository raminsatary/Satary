import { instruments, sample, sma } from "./engine.js";
import {
  newAccount,
  submitOrder,
  cancelOrder,
  advanceAccount,
  closePosition,
  modifyProtection,
  accountEquity,
  plannedRisk,
  ema,
  rsi,
  vwap,
  atr,
  baseRates,
} from "./paper.js";
const h = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const dollars = (n) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" }),
  price = (n) =>
    n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
let state = null,
  tapes = {},
  cursors = {},
  selected = "MNQ",
  timer = null,
  windowBars = 65,
  overlay = "sma",
  drawMode = "entry",
  level = null,
  autoAdvanceMarket = true;
function validReplay(data) {
  const a = data?.account;
  const positive = (v) => Number.isFinite(v) && v > 0;
  const symbol = (v) => typeof v === "string" && Object.hasOwn(instruments, v);
  if (
    a?.version !== 1 ||
    typeof a.id !== "string" ||
    !a.id ||
    !positive(a.initial) ||
    !Number.isFinite(a.balance) ||
    !Number.isInteger(a.sequence) ||
    a.sequence < 0 ||
    ![a.riskPercent, a.dailyLossPercent, a.marginPerContract].every(positive) ||
    ![a.fees, a.slipTicks].every((v) => Number.isFinite(v) && v >= 0) ||
    !Number.isInteger(a.slipTicks) ||
    !Array.isArray(a.orders) ||
    !Array.isArray(a.positions) ||
    !Array.isArray(a.trades)
  )
    return false;
  if (
    !a.positions.every(
      (p) =>
        symbol(p.symbol) &&
        positive(p.entry) &&
        positive(p.mark) &&
        positive(p.stop) &&
        positive(p.target) &&
        Number.isInteger(p.quantity) &&
        p.quantity > 0 &&
        [-1, 1].includes(p.side) &&
        Number.isFinite(p.entryFees) &&
        p.entryFees >= 0,
    )
  )
    return false;
  if (
    !a.orders.every(
      (o) =>
        symbol(o.symbol) &&
        ["working", "filled", "cancelled", "rejected"].includes(o.status) &&
        ["buy", "sell"].includes(o.side) &&
        ["market", "limit", "stop"].includes(o.type) &&
        Number.isInteger(o.quantity) &&
        o.quantity > 0 &&
        positive(o.stop) &&
        positive(o.target) &&
        (o.type === "market" || positive(o.price)) &&
        Number.isInteger(o.submittedIndex) &&
        o.submittedIndex >= 0,
    )
  )
    return false;
  if (
    !a.trades.every(
      (t) =>
        symbol(t.symbol) &&
        positive(t.entry) &&
        positive(t.exit) &&
        Number.isInteger(t.quantity) &&
        t.quantity > 0 &&
        Number.isFinite(t.net),
    )
  )
    return false;
  if (
    !data.tapes ||
    typeof data.tapes !== "object" ||
    Array.isArray(data.tapes) ||
    !data.cursors ||
    typeof data.cursors !== "object" ||
    Array.isArray(data.cursors)
  )
    return false;
  for (const [name, bars] of Object.entries(data.tapes))
    if (
      !symbol(name) ||
      !Array.isArray(bars) ||
      bars.length < 3 ||
      !bars.every(
        (b, i) =>
          [b.time, b.open, b.high, b.low, b.close, b.volume].every(
            Number.isFinite,
          ) &&
          positive(b.open) &&
          positive(b.close) &&
          positive(b.low) &&
          b.low <= Math.min(b.open, b.close) &&
          b.high >= Math.max(b.open, b.close) &&
          (i === 0 || b.time > bars[i - 1].time),
      )
    )
      return false;
  for (const [name, index] of Object.entries(data.cursors))
    if (
      !symbol(name) ||
      !data.tapes[name] ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= data.tapes[name].length
    )
      return false;
  return true;
}
function restore() {
  if (state) return;
  try {
    const data = JSON.parse(localStorage.getItem("satary-paper-v1") || "null");
    if (validReplay(data)) {
      state = data.account;
      tapes = data.tapes || {};
      cursors = data.cursors || {};
    }
  } catch {}
  state ??= newAccount();
}
export function disposePractice() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
export function practicePage(
  container,
  { getImport, onTrades, onGo, initialSymbol } = {},
) {
  restore();
  if (initialSymbol && instruments[initialSymbol]) selected = initialSymbol;
  disposePractice();
  let message = "";
  const tape = () => tapes[selected] || (tapes[selected] = sample(selected));
  const cursor = () =>
    cursors[selected] ?? (cursors[selected] = Math.min(59, tape().length - 2));
  const current = () => tape()[cursor()];
  const round = (v) => {
    const tick = instruments[selected].tick,
      decimals = (String(tick).split(".")[1] || "").length;
    return Number((Math.round(v / tick) * tick).toFixed(decimals));
  };
  function persist(feedback = "Practice account saved on this device.") {
    try {
      localStorage.setItem(
        "satary-paper-v1",
        JSON.stringify({ account: state, tapes, cursors }),
      );
      message = feedback;
    } catch {
      message =
        feedback +
        " Browser storage is unavailable or full. Export the account before leaving.";
    }
    onTrades?.(state.trades);
  }
  function act(fn) {
    try {
      const feedback = fn();
      persist(typeof feedback === "string" ? feedback : undefined);
      render();
    } catch (e) {
      message = e.message;
      const status = container.querySelector("#practice-status");
      if (status) {
        container.querySelector("#practice-feedback").hidden = false;
        status.textContent = message;
        status.classList.add("is-error");
        status.focus({ preventScroll: false });
      }
    }
  }
  function step() {
    if (!container.isConnected) {
      disposePractice();
      return;
    }
    if (cursor() >= tape().length - 1) {
      disposePractice();
      message = "Replay complete. Export or choose another dataset.";
      render();
      return;
    }
    act(() => {
      const before = state,
        next = cursor() + 1;
      const updated = advanceAccount(state, selected, tape()[next], next);
      cursors[selected] = next;
      state = updated;
      return replayFeedback(before, updated);
    });
  }
  function replayFeedback(before, after) {
    const changes = [];
    for (const order of after.orders) {
      const prior = before.orders.find((o) => o.id === order.id);
      if (order.status === prior?.status) continue;
      if (order.status === "filled")
        changes.push(
          `${order.symbol} ${order.side === "buy" ? "buy" : "sell"} filled: ${order.quantity} at ${price(order.fill)}.`,
        );
      if (order.status === "rejected")
        changes.push(`Order rejected: ${order.reason}`);
    }
    for (const trade of after.trades.slice(before.trades.length))
      changes.push(
        `${trade.symbol} closed (${trade.exitReason}); net ${dollars(trade.net)}. Added to your journal.`,
      );
    return (
      changes.join(" ") ||
      "Replay advanced one bar. Working orders remain pending until their price is reached."
    );
  }
  function render() {
    const info = instruments[selected],
      bar = current(),
      equity = accountEquity(state),
      history = tape().slice(0, cursor() + 1),
      ind = rsi(history).at(-1),
      vol = atr(history).at(-1),
      rates = baseRates(history),
      stopDistance = round(Math.max(info.tick * 20, (vol || 0) * 1.5)),
      pnl = equity - state.initial;
    container.innerHTML = `<div class="training-banner"><strong>DEMO REPLAY · ${tapes[selected]?.[0]?.imported ? "IMPORTED HISTORY" : "SYNTHETIC DATA"}</strong><span>No real orders or real funds. External market quotes are separate from fills.</span></div><section class="first-trade-guide"><strong>Your first demo trade</strong><span>1. Choose Buy or Sell. &nbsp; 2. Submit your order. &nbsp; 3. Review the fill below.</span><label class="check-label"><input id="auto-advance-market" type="checkbox" ${autoAdvanceMarket ? "checked" : ""}> Advance one replay bar after a market order (recommended)</label><button id="guide-ticket">Open order ticket ↓</button><p>Market orders fill at the next replay open. Limit and stop-entry orders wait for their price; use Next bar or Play replay.</p></section><div class="practice-feedback" id="practice-feedback" ${message ? "" : "hidden"}><p id="practice-status" role="status" aria-live="polite" tabindex="-1">${h(message)}</p>${state.orders.some((o) => o.status === "working" && o.symbol === selected) ? '<button id="feedback-step">Advance next bar →</button>' : ""}${state.positions.some((p) => p.symbol === selected) ? '<button id="feedback-position">See open position ↓</button>' : ""}</div><div class="stats">${[
      ["Account equity", dollars(equity)],
      ["Cash balance", dollars(state.balance)],
      ["Total P&L", dollars(pnl)],
      ["Open positions", state.positions.length],
    ]
      .map(
        ([k, v]) =>
          `<div class="stat"><small>${k}</small><strong>${v}</strong></div>`,
      )
      .join(
        "",
      )}</div><div class="practice-layout"><section class="panel"><div class="chart-title"><div><strong>${selected} · ${info.name}</strong><p>${new Date(bar.time).toISOString().slice(0, 16).replace("T", " ")} UTC · ${cursor() + 1}/${tape().length} bars</p></div><span class="badge">${price(bar.close)}</span></div><div class="practice-tools"><label>Instrument<select id="practice-symbol">${Object.keys(
      instruments,
    )
      .map((s) => `<option ${selected === s ? "selected" : ""}>${s}</option>`)
      .join("")}</select></label><label>Overlay<select id="practice-overlay">${[
      ["sma", "SMA 9 / 21"],
      ["ema", "EMA 9 / 21"],
      ["vwap", "Session VWAP (UTC)"],
      ["bollinger", "Bollinger 20 / 2σ"],
      ["none", "No overlay"],
    ]
      .map(
        ([v, t]) =>
          `<option value="${v}" ${v === overlay ? "selected" : ""}>${t}</option>`,
      )
      .join(
        "",
      )}</select></label><button id="step-replay">Next bar →</button><button id="play-replay">${timer ? "Pause" : "Play replay"}</button><button id="practice-zoom-in" aria-label="Zoom in">＋</button><button id="practice-zoom-out" aria-label="Zoom out">−</button></div><div class="chart-trade-buttons"><button id="chart-buy" class="buy-button">Buy demo</button><button id="chart-sell" class="sell-button">Sell demo</button><label>Click chart to set<select id="chart-click-mode">${["entry", "stop", "target", "level"].map((m) => `<option ${m === drawMode ? "selected" : ""}>${m}</option>`).join("")}</select></label></div><svg id="practice-chart" class="practice-chart" viewBox="0 0 850 380" role="img" tabindex="0" aria-label="Replay candlesticks. Click to set a ticket price. Buy and sell buttons submit demo orders."></svg><p class="chart-readout" id="practice-ohlc">O ${price(bar.open)} · H ${price(bar.high)} · L ${price(bar.low)} · C ${price(bar.close)}</p><div class="indicator-strip"><span>RSI 14: ${ind === null ? "Warming up" : ind.toFixed(1)}</span><span>ATR 14: ${vol === null ? "Warming up" : price(vol)}</span><span>Tick ${info.tick} · Tick value ${dollars(info.tick * info.point)}</span></div><div class="panel-explanation"><strong>Historical frequency, not a forecast</strong><p>In ${rates.count} non-overlapping ${rates.horizon}-bar windows already revealed, ${rates.count ? ((rates.up / rates.count) * 100).toFixed(1) : "0"}% rose and ${rates.count ? ((rates.down / rates.count) * 100).toFixed(1) : "0"}% fell (${rates.flat} unchanged). ${tapes[selected]?.[0]?.imported ? "Imported history" : "Synthetic sample"}; not a news-conditioned probability or a prediction.</p></div></section><aside class="panel page-panel order-panel"><h2>Demo order ticket</h2><p>Practice ${info.kind === "future" ? "contracts" : "whole shares"}. Orders become eligible on the next replay bar.</p><form id="paper-order"><label>Side<select name="side"><option value="buy">Buy / long</option><option value="sell">Sell / short</option></select></label><div class="form-grid"><label>Order type<select name="type"><option value="market">Market</option><option value="limit">Limit</option><option value="stop">Stop entry</option></select></label><label>Quantity<input name="quantity" type="number" min="1" step="1" value="1" required></label><label>Entry price<input name="price" type="number" min="${info.tick}" step="${info.tick}" value="${round(bar.close)}" required></label><label>Stop loss<input name="stop" type="number" min="${info.tick}" step="${info.tick}" value="${round(bar.close - stopDistance)}" required></label><label>Take profit<input name="target" type="number" min="${info.tick}" step="${info.tick}" value="${round(bar.close + stopDistance * 2)}" required></label><label>Trailing stop (ticks, 0 = off)<input name="trailTicks" type="number" min="0" step="1" value="0"></label><label>Setup<select name="setup"><option>Trend pullback</option><option>Breakout</option><option>Range reversal</option><option>News reaction</option><option>Practice</option></select></label></div><label>Trade thesis<textarea name="notes" rows="2" maxlength="2000" placeholder="Why this trade? What invalidates it?"></textarea></label><p id="risk-preview" class="risk-preview"></p><button class="primary">Submit demo order</button></form><details><summary>Fill rules & account settings</summary><p>Market and stop fills include slippage. Limit orders never fill worse than the limit. Stop gaps use the open; if a bar touches both bracket exits, the stop wins. Intrabar limit targets wait until a later bar unless entry filled at the open. Trailing stops tighten after a completed bar and take effect on the next bar. Shorting is simplified. No exchange queue, borrow, liquidation, rollover, or actual broker margin is modeled.</p><form id="paper-settings">${[
      ["fees", "Fee per unit / side ($)", state.fees, 0.001],
      ["slipTicks", "Slippage (ticks)", state.slipTicks, 1],
      ["riskPercent", "Max risk per trade (%)", state.riskPercent, 0.1],
      [
        "dailyLossPercent",
        "Daily realized loss limit (%)",
        state.dailyLossPercent,
        0.1,
      ],
      [
        "marginPerContract",
        "Training reserve / futures contract ($)",
        state.marginPerContract,
        1,
      ],
    ]
      .map(
        ([name, label, value, step]) =>
          `<label>${label}<input name="${name}" type="number" value="${value}" min="${name === "fees" || name === "slipTicks" ? 0 : 0.1}" step="${step}" required></label>`,
      )
      .join(
        "",
      )}<button>Update practice settings</button></form></details><button id="paper-export">Export practice backup ↓</button><div class="dataset-actions"><button id="paper-use-csv" ${getImport?.(selected) ? "" : "disabled"}>Use imported ${selected} CSV</button><button id="paper-reset-request">Reset practice account</button></div><div id="paper-reset-confirm" hidden><p>Reset clears the practice account and replay. Journal copies remain.</p><button id="paper-reset">Confirm reset to $25,000</button></div></aside></div><section class="panel page-panel trade-management"><h2>Positions & working orders</h2><p>Each instrument has its own replay clock. Other positions keep their last replay price until you advance that instrument. Stops and targets form an OCO bracket: closing either removes the other.</p><div class="table-wrap"><table><thead><tr><th>POSITION</th><th>ENTRY / MARK</th><th>UNREALIZED</th><th>STOP / TARGET</th><th>MANAGE</th></tr></thead><tbody>${state.positions.map((p) => `<tr><td>${p.symbol} · ${p.side === 1 ? "Long" : "Short"} × ${p.quantity}${p.trailTicks ? `<small>Trailing ${p.trailTicks} ticks</small>` : ""}</td><td>${price(p.entry)} / ${price(p.mark)}</td><td>${dollars((p.mark - p.entry) * p.side * instruments[p.symbol].point * p.quantity)}</td><td><label>Stop<input data-position-stop="${p.id}" type="number" step="${instruments[p.symbol].tick}" value="${p.stop}"></label><label>Target<input data-position-target="${p.id}" type="number" step="${instruments[p.symbol].tick}" value="${p.target}"></label><button data-protect="${p.id}">Apply bracket</button><button data-breakeven="${p.id}">Stop at entry</button></td><td><label>Close quantity<input data-close-qty="${p.id}" type="number" min="1" max="${p.quantity}" step="1" value="${p.quantity}"></label><button data-close-position="${p.id}">Close / reduce</button></td></tr>`).join("")}</tbody></table>${!state.positions.length ? "<p>No open positions. Submit an order, then advance the replay.</p>" : ""}</div><div class="table-wrap"><table><thead><tr><th>ORDER</th><th>TYPE / SIDE</th><th>QTY / PRICE</th><th>STATUS</th><th></th></tr></thead><tbody>${state.orders
      .slice(-20)
      .reverse()
      .map(
        (o) =>
          `<tr><td>${o.symbol}</td><td>${o.type} / ${o.side}</td><td>${o.quantity} / ${o.type === "market" ? "Next open" : price(o.price)}</td><td>${o.status}${o.reason ? ": " + h(o.reason) : ""}</td><td>${o.status === "working" ? `<button data-cancel-order="${o.id}">Cancel</button>` : ""}</td></tr>`,
      )
      .join(
        "",
      )}</tbody></table></div><p>Closed trades automatically appear in your journal, including costs, setup, exit reason, and planned risk.</p><button class="text-button" data-go="journal">Review your trades →</button></section>`;
    const $ = (s) => container.querySelector(s),
      form = $("#paper-order");
    function spec(side) {
      const d = Object.fromEntries(new FormData(form));
      return {
        ...d,
        side: side || d.side,
        symbol: selected,
        quantity: +d.quantity,
        price: +d.price,
        stop: +d.stop,
        target: +d.target,
        trailTicks: +d.trailTicks || 0,
      };
    }
    function preview() {
      const o = spec(),
        entry = o.type === "market" ? bar.close : o.price,
        sign = o.side === "buy" ? 1 : -1;
      const risk = plannedRisk(state, o, entry),
        reward = (o.target - entry) * sign * info.point * o.quantity;
      $("#risk-preview").textContent =
        `Estimated risk incl. costs/slippage: ${Number.isFinite(risk) ? dollars(risk) : "—"} · ${Number.isFinite(reward) && risk > 0 ? (reward / risk).toFixed(2) + "R potential gross reward" : "Check prices"} · Limit ${state.riskPercent}% of equity`;
      form.elements.price.disabled = form.elements.type.value === "market";
    }
    function place(side) {
      if (!form.reportValidity()) return;
      const order = spec(side);
      disposePractice();
      act(() => {
        if (cursor() >= tape().length - 1)
          throw Error(
            "Replay is at its final bar. Choose another instrument or load a new dataset before submitting an order.",
          );
        const before = state,
          queued = submitOrder(state, order, bar.close, cursor(), bar.time);
        if (order.type === "market" && autoAdvanceMarket) {
          const next = cursor() + 1;
          const updated = advanceAccount(queued, selected, tape()[next], next);
          state = updated;
          cursors[selected] = next;
          return replayFeedback(before, updated);
        }
        state = queued;
        return `${selected} ${order.side === "buy" ? "buy" : "sell"} order accepted and waiting. ${order.type === "market" ? "Press Advance next bar to fill at the next replay open." : "Press Next bar or Play replay; it fills only when its entry price is reached."}`;
      });
      container
        .querySelector("#practice-status")
        .focus({ preventScroll: false });
    }
    $("#guide-ticket").onclick = () =>
      form.scrollIntoView?.({ behavior: "smooth", block: "start" });
    $("#auto-advance-market").onchange = (e) =>
      (autoAdvanceMarket = e.target.checked);
    if ($("#feedback-step")) $("#feedback-step").onclick = step;
    if ($("#feedback-position"))
      $("#feedback-position").onclick = () =>
        container
          .querySelector(".trade-management")
          .scrollIntoView?.({ behavior: "smooth", block: "start" });
    form.addEventListener(
      "invalid",
      (e) => {
        const field = e.target;
        const name = field.labels?.[0]?.textContent.trim() || field.name;
        message = `Check ${name}: ${field.validationMessage || "enter a valid value."}`;
        $("#practice-feedback").hidden = false;
        $("#practice-status").textContent = message;
        $("#practice-status").classList.add("is-error");
      },
      true,
    );
    form.oninput = () => {
      disposePractice();
      $("#play-replay").textContent = "Play replay";
      preview();
    };
    form.onsubmit = (e) => {
      e.preventDefault();
      place();
    };
    form.elements.side.onchange = () => {
      const sign = form.elements.side.value === "buy" ? 1 : -1;
      form.elements.stop.value = round(bar.close - sign * stopDistance);
      form.elements.target.value = round(bar.close + sign * stopDistance * 2);
      preview();
    };
    $("#chart-buy").onclick = () => {
      if (form.elements.side.value !== "buy") {
        form.elements.side.value = "buy";
        form.elements.side.onchange();
      }
      place("buy");
    };
    $("#chart-sell").onclick = () => {
      if (form.elements.side.value !== "sell") {
        form.elements.side.value = "sell";
        form.elements.side.onchange();
      }
      place("sell");
    };
    $("#practice-symbol").onchange = (e) => {
      disposePractice();
      selected = e.target.value;
      ((level = null), (autoAdvanceMarket = true));
      render();
    };
    $("#practice-overlay").onchange = (e) => {
      overlay = e.target.value;
      draw();
    };
    $("#chart-click-mode").onchange = (e) => (drawMode = e.target.value);
    $("#step-replay").onclick = step;
    $("#play-replay").onclick = () => {
      if (timer) disposePractice();
      else timer = setInterval(step, 1000);
      render();
    };
    $("#practice-zoom-in").onclick = () => {
      windowBars = Math.max(20, windowBars - 15);
      draw();
    };
    $("#practice-zoom-out").onclick = () => {
      windowBars = Math.min(160, windowBars + 15);
      draw();
    };
    container
      .querySelectorAll("[data-cancel-order]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            act(() => (state = cancelOrder(state, b.dataset.cancelOrder)))),
      );
    container.querySelectorAll("[data-close-position]").forEach(
      (b) =>
        (b.onclick = () =>
          act(() => {
            const p = state.positions.find(
              (p) => p.id === b.dataset.closePosition,
            );
            state = closePosition(
              state,
              p.id,
              +$(`[data-close-qty="${p.id}"]`).value,
              tapes[p.symbol][cursors[p.symbol]].time,
            );
            const trade = state.trades.at(-1);
            return `${trade.symbol} closed: net ${dollars(trade.net)}. Added to your journal.`;
          })),
    );
    container
      .querySelectorAll("[data-protect]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            act(
              () =>
                (state = modifyProtection(
                  state,
                  b.dataset.protect,
                  +$(`[data-position-stop="${b.dataset.protect}"]`).value,
                  +$(`[data-position-target="${b.dataset.protect}"]`).value,
                )),
            )),
      );
    container.querySelectorAll("[data-breakeven]").forEach(
      (b) =>
        (b.onclick = () =>
          act(() => {
            const p = state.positions.find((p) => p.id === b.dataset.breakeven);
            state = modifyProtection(state, p.id, p.entry, p.target);
          })),
    );
    $("#paper-settings").onsubmit = (e) => {
      e.preventDefault();
      act(() => {
        const d = Object.fromEntries(
          [...new FormData(e.target)].map(([k, v]) => [k, +v]),
        );
        if (
          Object.values(d).some((v) => !Number.isFinite(v) || v < 0) ||
          d.riskPercent <= 0 ||
          d.riskPercent > 5 ||
          d.dailyLossPercent <= 0 ||
          d.dailyLossPercent > 20 ||
          d.marginPerContract <= 0 ||
          !Number.isInteger(d.slipTicks)
        )
          throw Error(
            "Use risk > 0 and ≤ 5%, daily loss > 0 and ≤ 20%, whole slippage ticks, and positive training reserve.",
          );
        Object.assign(state, d);
      });
    };
    $("#paper-export").onclick = () => {
      const url = URL.createObjectURL(
          new Blob(
            [JSON.stringify({ account: state, tapes, cursors }, null, 2)],
            { type: "application/json" },
          ),
        ),
        a = document.createElement("a");
      a.href = url;
      a.download = "trade-rehearsal-practice-backup.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    $("#paper-reset-request").onclick = () =>
      ($("#paper-reset-confirm").hidden = false);
    $("#paper-reset").onclick = () =>
      act(() => {
        disposePractice();
        state = newAccount();
        tapes = {};
        cursors = {};
      });
    $("#paper-use-csv").onclick = () =>
      act(() => {
        if (
          state.positions.some((p) => p.symbol === selected) ||
          state.orders.some(
            (o) => o.symbol === selected && o.status === "working",
          )
        )
          throw Error(
            "Close positions and cancel working orders for this instrument before replacing its replay.",
          );
        const data = getImport?.(selected);
        if (!data || data.length < 25)
          throw Error("Import at least 25 bars in Data library first.");
        tapes[selected] = data.map((b) => ({ ...b }));
        tapes[selected][0].imported = true;
        cursors[selected] = Math.min(59, data.length - 2);
      });
    container
      .querySelectorAll("[data-go]")
      .forEach((b) => (b.onclick = () => onGo?.(b.dataset.go)));
    preview();
    draw();
    function draw() {
      const svg = $("#practice-chart"),
        visible = history.slice(-windowBars),
        start = history.length - visible.length,
        positions = state.positions.filter((p) => p.symbol === selected),
        levels = positions.flatMap((p) => [p.entry, p.stop, p.target]);
      if (level) levels.push(level);
      const low = Math.min(...visible.map((b) => b.low), ...levels),
        high = Math.max(...visible.map((b) => b.high), ...levels),
        pad = (high - low) * 0.12 || 1,
        min = low - pad,
        max = high + pad,
        y = (v) => 290 - ((v - min) / (max - min)) * 270,
        x = (i) => 12 + ((i + 0.5) * 740) / visible.length,
        w = Math.max(2, (740 / visible.length) * 0.6);
      let html = "";
      for (let k = 0; k < 6; k++) {
        const v = min + ((max - min) * k) / 5;
        html += `<line x1="0" x2="760" y1="${y(v)}" y2="${y(v)}" stroke="#dfe7e1" stroke-dasharray="4 4"/><text x="770" y="${y(v) + 4}" font-size="11" fill="#63766a">${price(v)}</text>`;
      }
      visible.forEach((b, i) => {
        const color = b.close >= b.open ? "#2a8561" : "#bf6659";
        html += `<line x1="${x(i)}" x2="${x(i)}" y1="${y(b.high)}" y2="${y(b.low)}" stroke="${color}"/><rect x="${x(i) - w / 2}" y="${Math.min(y(b.open), y(b.close))}" width="${w}" height="${Math.max(1, Math.abs(y(b.open) - y(b.close)))}" fill="${color}"/>`;
        if (i % Math.ceil(visible.length / 5) === 0)
          html += `<text x="${x(i)}" y="312" font-size="10" fill="#63766a">${new Date(b.time).toISOString().slice(11, 16)}</text>`;
      });
      const line = (values, color) => {
        html += `<path d="${values
          .slice(start)
          .map((v, i) =>
            v === null
              ? ""
              : `${i === 0 || values[start + i - 1] === null ? "M" : "L"}${x(i)},${y(v)}`,
          )
          .join(" ")}" fill="none" stroke="${color}" stroke-width="1.5"/>`;
      };
      if (overlay === "sma" || overlay === "ema") {
        line(overlay === "sma" ? sma(history, 9) : ema(history, 9), "#c69f44");
        line(
          overlay === "sma" ? sma(history, 21) : ema(history, 21),
          "#758ec7",
        );
      }
      if (overlay === "vwap") line(vwap(history), "#ad75b2");
      if (overlay === "bollinger") {
        const mid = sma(history, 20);
        line(mid, "#8ba480");
        for (const sign of [-1, 1])
          line(
            mid.map((v, i) =>
              v === null
                ? null
                : v +
                  sign *
                    2 *
                    Math.sqrt(
                      history
                        .slice(i - 19, i + 1)
                        .reduce((n, b) => n + (b.close - v) ** 2, 0) / 20,
                    ),
            ),
            "#9aafc7",
          );
      }
      for (const p of positions)
        for (const [value, color, label] of [
          [p.entry, "#607da6", "Entry"],
          [p.stop, "#b75c4e", "Stop"],
          [p.target, "#2a8561", "Target"],
        ])
          html += `<line x1="0" x2="760" y1="${y(value)}" y2="${y(value)}" stroke="${color}" stroke-dasharray="5 3"/><text x="20" y="${y(value) - 5}" fill="${color}" font-size="11">${label} ${price(value)}</text>`;
      if (level)
        html += `<line x1="0" x2="760" y1="${y(level)}" y2="${y(level)}" stroke="#9376a4"/><text x="20" y="${y(level) - 5}" font-size="11">Your level ${price(level)}</text>`;
      html +=
        '<line x1="0" x2="760" y1="328" y2="328" stroke="#dfe7e1"/><text x="770" y="350" font-size="10">RSI 14</text>';
      const strength = rsi(history).slice(start);
      html += `<path d="${strength.map((v, i) => (v === null ? "" : `${i === 0 || strength[i - 1] === null ? "M" : "L"}${x(i)},${375 - v * 0.4}`)).join(" ")}" fill="none" stroke="#9376a4" stroke-width="1.5"/>`;
      svg.innerHTML = html;
      svg.onclick = (e) => {
        const rect = svg.getBoundingClientRect(),
          py = ((e.clientY - rect.top) / rect.height) * 380;
        if (py < 15 || py > 290) return;
        const value = round(min + ((290 - py) / 270) * (max - min));
        if (drawMode === "level") {
          level = value;
          draw();
        } else {
          if (drawMode === "entry") {
            form.elements.type.value = "limit";
            form.elements.price.disabled = false;
            form.elements.price.value = value;
          } else form.elements.namedItem(drawMode).value = value;
          preview();
        }
      };
      svg.onkeydown = (e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          step();
        }
      };
      svg.onpointermove = (e) => {
        const rect = svg.getBoundingClientRect(),
          i = Math.max(
            0,
            Math.min(
              visible.length - 1,
              Math.floor(
                ((((e.clientX - rect.left) / rect.width) * 850) / 760) *
                  visible.length,
              ),
            ),
          ),
          b = visible[i];
        $("#practice-ohlc").textContent =
          `${new Date(b.time).toISOString().slice(0, 16)} UTC · O ${price(b.open)} · H ${price(b.high)} · L ${price(b.low)} · C ${price(b.close)} · Volume ${b.volume}`;
      };
    }
  }
  render();
}
