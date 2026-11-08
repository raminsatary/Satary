import { learnPage, marketsPage } from "./learn.js";
import { practicePage, disposePractice } from "./practice.js";
import { calendarPage, newsPage } from "./macro.js";
import { mountTradingView, tradingViewSymbols } from "./tradingview.js";
import {
  instruments,
  sample,
  sma,
  parseCSV,
  backtest,
  tradePnl,
  performance,
} from "./engine.js";
const $ = (s) => document.querySelector(s),
  fmt = (n) =>
    n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
  money = (n) => "$" + fmt(n),
  esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const labSettings = {
  fast: 9,
  slow: 21,
  quantity: 1,
  commission: 1.24,
  slippage: 1,
  direction: "long",
};
let chartSource = "tradingview";
let symbol = "MNQ",
  page = "chart",
  interval = 5,
  visible = 90,
  offset = 0,
  showMA = true,
  journal = [];
try {
  journal = JSON.parse(localStorage.getItem("satary-journal") || "[]");
  if (!Array.isArray(journal)) journal = [];
  journal = journal
    .filter(
      (t) =>
        t &&
        instruments[t.symbol] &&
        ["Long", "Short"].includes(t.direction) &&
        [t.entry, t.exit, t.quantity].every(Number.isFinite) &&
        t.entry > 0 &&
        t.exit > 0 &&
        Number.isInteger(t.quantity) &&
        t.quantity > 0 &&
        Number.isFinite(Number(t.fees || 0)) &&
        Number(t.fees || 0) >= 0,
    )
    .map((t) => ({
      ...t,
      id: String(t.id || crypto.randomUUID()),
      fees: Number(t.fees || 0),
    }));
} catch {}
const imports = {},
  bars = () => imports[symbol] || sample(symbol, interval);
const demo = () => !imports[symbol];
function toast(s) {
  $("#toast").textContent = s;
  $("#toast").style.display = "block";
  setTimeout(() => ($("#toast").style.display = "none"), 3500);
}
function save() {
  try {
    localStorage.setItem("satary-journal", JSON.stringify(journal));
    toast("Journal saved on this device");
  } catch {
    toast("Storage unavailable. Export your journal to keep it.");
  }
}
function download(name, text) {
  const u = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
function stats(items) {
  return (
    '<div class="stats">' +
    items
      .map(
        ([label, value]) =>
          `<div class="stat"><small>${label}</small><strong>${value}</strong></div>`,
      )
      .join("") +
    "</div>"
  );
}
const pnl = tradePnl;
let editingId = null,
  journalFilter = "",
  journalContract = "",
  journalSide = "",
  journalFrom = "",
  journalTo = "",
  journalOrigin = "";
const titles = {
  start: [
    "Start here",
    "Build confidence, one decision at a time.",
    "Learn, observe, practice with virtual funds, and review your process.",
  ],
  markets: [
    "Market watch",
    "Find your market. Understand the instrument.",
    "Stocks, ETFs, and micro futures with separate provider quotes and practice data.",
  ],
  practice: [
    "Demo trading",
    "Practice the decision. Review the outcome.",
    "A virtual replay account with chart orders, bracket protection, and automatic journaling.",
  ],
  calendar: [
    "Economic calendar",
    "Know what’s on the calendar.",
    "Plan your session around the releases that matter.",
  ],
  news: [
    "News & briefing",
    "Make room for the bigger picture.",
    "Follow market headlines and build your own session briefing.",
  ],
  chart: [
    "Chart workspace",
    "Your market. Your perspective.",
    "A focused space to chart your ideas and find your edge.",
  ],
  journal: [
    "Trade journal",
    "Every trade has a lesson.",
    "Capture your setups, reflect on decisions, and track your progress.",
  ],
  backtest: [
    "Strategy lab",
    "Turn an idea into evidence.",
    "Explore your strategy before putting capital at risk.",
  ],
  data: [
    "Data library",
    "Start with the right foundation.",
    "Bring your own history. Know exactly what you’re testing.",
  ],
};
function syncPaperTrades(trades) {
  let synced = [];
  try {
    synced = JSON.parse(localStorage.getItem("satary-paper-synced") || "[]");
    if (!Array.isArray(synced)) synced = [];
  } catch {}
  const known = new Set(synced);
  for (const trade of trades)
    if (!known.has(trade.id)) {
      if (!journal.some((t) => t.id === trade.id))
        journal.unshift({ ...trade });
      known.add(trade.id);
    }
  try {
    localStorage.setItem("satary-journal", JSON.stringify(journal));
    localStorage.setItem("satary-paper-synced", JSON.stringify([...known]));
    $("#trade-count").textContent = journal.length;
  } catch {
    toast("Journal storage unavailable. Export your practice account.");
  }
}
function go(p) {
  history.pushState(null, "", `#${p}`);
  page = p;
  render();
  window.scrollTo({ top: 0 });
}
function render() {
  disposePractice();
  if ($("#mobile-route")) $("#mobile-route").value = page;
  const t = titles[page];
  $("#markets").hidden = [
    "start",
    "markets",
    "practice",
    "journal",
    "calendar",
    "news",
  ].includes(page);
  $("#breadcrumb").textContent = t[0];
  $("#page-title").textContent = t[1];
  $("#page-subtitle").textContent = t[2];
  $("#trade-count").textContent = journal.length;
  document
    .querySelectorAll("[data-page]")
    .forEach(
      (b) => (
        b.classList.toggle("active", b.dataset.page === page),
        b.setAttribute("aria-label", titles[b.dataset.page][0]),
        b.setAttribute(
          "aria-current",
          b.dataset.page === page ? "page" : "false",
        )
      ),
    );
  $("#markets").innerHTML = Object.entries(instruments)
    .filter(([s]) => ["MNQ", "MES", "MGC"].includes(s))
    .map(([s, info]) => {
      const b = imports[s] || sample(s, interval),
        last = b.at(-1).close,
        change = (last / b[0].open - 1) * 100;
      return `<button class="market-card ${s === symbol ? "selected" : ""}" data-symbol="${s}"><span class="symbol">${s}</span><span class="tag">${imports[s] ? "CSV" : "DEMO"}</span><div class="market-name">${info.name}</div><div class="quote"><strong>${fmt(last)}</strong><span class="${change >= 0 ? "positive" : "negative"}">${change >= 0 ? "+" : ""}${change.toFixed(2)}% ${change >= 0 ? "↗" : "↘"}</span></div><span class="card-source">${imports[s] ? b.length + " imported bars" : "Synthetic · not live"}</span></button>`;
    })
    .join("");
  document.querySelectorAll("[data-symbol]").forEach(
    (b) =>
      (b.onclick = () => {
        symbol = b.dataset.symbol;
        offset = 0;
        render();
      }),
  );
  ({
    start: () => learnPage($("#page")),
    markets: () =>
      marketsPage($("#page"), {
        onSelect: (s, p) => {
          symbol = s;
          go(p);
        },
      }),
    practice: () =>
      practicePage($("#page"), {
        initialSymbol: symbol,
        getImport: (s) => imports[s],
        onGo: go,
        onTrades: syncPaperTrades,
      }),
    chart: chartPage,
    journal: journalPage,
    backtest: labPage,
    data: dataPage,
    calendar: () => calendarPage($("#page")),
    news: () => newsPage($("#page")),
  })[page]();
  document
    .querySelectorAll("[data-go]")
    .forEach((b) => (b.onclick = () => go(b.dataset.go)));
}
function localChartPage() {
  const info = instruments[symbol];
  $("#page").innerHTML =
    `<div class="chart-layout"><section class="panel"><div class="chart-title"><div><strong>${symbol}</strong><span class="market-name"> &nbsp; ${info.name}</span></div><span class="badge">◉ ${demo() ? "SYNTHETIC DEMO" : "IMPORTED CSV"}</span></div><div class="chart-tools">${[1, 5, 15, 60].map((n) => `<button data-time="${n}" class="${n === interval ? "active" : ""}" ${!demo() ? "disabled" : ""}>${n === 60 ? "1h" : n + "m"}</button>`).join("")}<span class="tool-divider"></span><button id="ma" class="${showMA ? "active" : ""}">⌁ SMA 9 / 21</button><span class="tool-divider"></span><button id="zoom-in" aria-label="Zoom in">＋</button><button id="zoom-out" aria-label="Zoom out">−</button><button id="previous" aria-label="Earlier bars">←</button><button id="next" aria-label="Later bars">→</button></div><div class="chart-meta" id="chart-meta"></div><svg id="chart" tabindex="0" class="chart-svg" viewBox="0 0 850 360" preserveAspectRatio="none" role="img" aria-label="${symbol} candlestick chart"></svg><div class="chart-bottom"><span>${demo() ? "Simulated history · Not live prices" : "Imported history · Original interval"} · UTC</span><button id="reset">Reset view ↺</button></div></section><aside class="panel side-panel"><h3>Watchlist <span style="float:right;color:#9aa694">⌘</span></h3>${Object.entries(
      instruments,
    )
      .map(
        ([s, i]) =>
          `<button type="button" class="watch-row" data-watch="${s}"><strong>${s}</strong><span>${fmt((imports[s] || sample(s, interval)).at(-1).close)}</span><small>${i.name.replace("Micro E-mini ", "")}</small><span class="positive">${imports[s] ? "Imported" : "Demo data"}</span></button>`,
      )
      .join("")}<div class="section-label">CONTRACT DETAILS</div>${[
      ["Exchange", symbol === "MGC" ? "COMEX" : "CME"],
      ["Tick size", info.tick.toFixed(2)],
      ["Tick value", money(info.tick * info.point)],
      ["Value / point", money(info.point)],
    ]
      .map(
        ([k, v]) =>
          `<div class="detail"><span>${k}</span><span>${v}</span></div>`,
      )
      .join(
        "",
      )}<div class="data-note">ⓘ &nbsp;${demo() ? "You’re exploring synthetic data. Import historical bars to test your market ideas." : "CSV data stays in memory for this session. Reloading returns to demo data."}</div></aside></div><div class="lower-grid"><section class="panel lower-card"><div class="card-heading"><h3>Your trading journal</h3><button class="text-button" data-go="journal">View journal ↗</button></div><div class="empty-journal"><div class="empty-icon">▤</div><div><strong>${journal.length ? journal.length + " trades. A growing perspective." : "A little reflection goes a long way."}</strong><p>${journal.length ? "Review decisions and refine your process." : "Log your first trade and start building your story."}</p></div></div></section><section class="panel lower-card"><div class="card-heading"><h3>Put your ideas to the test</h3><span class="badge">STRATEGY LAB</span></div><p class="lab-description">Explore a moving-average strategy with historical bars, costs, and a clear view of the results.</p><div class="lab-bottom"><span class="mini-tag">⌁ Simple MA crossover</span><button class="text-button" data-go="backtest">Open strategy lab ↗</button></div></section></div>`;
  document.querySelectorAll("[data-time]").forEach(
    (b) =>
      (b.onclick = () => {
        interval = +b.dataset.time;
        offset = 0;
        render();
      }),
  );
  document.querySelectorAll("[data-watch]").forEach(
    (b) =>
      (b.onclick = () => {
        symbol = b.dataset.watch;
        offset = 0;
        render();
      }),
  );
  $("#ma").onclick = () => {
    showMA = !showMA;
    chartPage();
  };
  $("#zoom-in").onclick = () => {
    visible = Math.max(20, visible - 20);
    draw();
  };
  $("#zoom-out").onclick = () => {
    visible = Math.min(bars().length, visible + 20);
    draw();
  };
  $("#previous").onclick = () => {
    offset = Math.max(0, Math.min(bars().length - visible, offset + 20));
    draw();
  };
  $("#next").onclick = () => {
    offset = Math.max(0, offset - 20);
    draw();
  };
  $("#reset").onclick = () => {
    visible = 90;
    offset = 0;
    draw();
  };
  draw();
}
function draw() {
  const all = bars(),
    end = all.length - offset,
    start = Math.max(0, end - visible),
    data = all.slice(start, end),
    low = Math.min(...data.map((b) => b.low)),
    high = Math.max(...data.map((b) => b.high)),
    pad = (high - low) * 0.13 || 1,
    min = low - pad,
    max = high + pad,
    y = (v) => 285 - ((v - min) / (max - min)) * 265,
    x = (i) => 15 + ((i + 0.5) * 745) / data.length,
    w = Math.max(1, (745 / data.length) * 0.57),
    vol = Math.max(1, ...data.map((b) => b.volume));
  let svg = "";
  for (let i = 0; i < 6; i++) {
    const v = min + ((max - min) * i) / 5;
    svg += `<line x1="0" x2="765" y1="${y(v)}" y2="${y(v)}" stroke="#edf0e9" stroke-dasharray="3 4"/><text x="777" y="${y(v) + 3}" fill="#98a18d" font-size="9">${fmt(v)}</text>`;
  }
  data.forEach((b, i) => {
    const c = b.close >= b.open ? "#619b7a" : "#ce8a7c";
    svg += `<line x1="${x(i)}" x2="${x(i)}" y1="${y(b.high)}" y2="${y(b.low)}" stroke="${c}"/><rect x="${x(i) - w / 2}" y="${Math.min(y(b.open), y(b.close))}" width="${w}" height="${Math.max(1, Math.abs(y(b.open) - y(b.close)))}" fill="${c}"/><rect x="${x(i) - w / 2}" y="${330 - (b.volume / vol) * 30}" width="${w}" height="${(b.volume / vol) * 30}" fill="${c}" opacity=".25"/>`;
    if (i % Math.max(1, Math.floor(data.length / 6)) === 0)
      svg += `<text x="${x(i)}" y="350" text-anchor="middle" fill="#99a18e" font-size="9">${new Date(b.time).toISOString().slice(11, 16)}</text>`;
  });
  if (showMA)
    for (const [period, color] of [
      [9, "#c6ad6e"],
      [21, "#8f9fbb"],
    ]) {
      const values = sma(all, period).slice(start, end);
      svg += `<path d="${values.map((v, i) => (v === null ? "" : `${i === 0 || values[i - 1] === null ? "M" : "L"}${x(i)},${y(v)}`)).join(" ")}" fill="none" stroke="${color}" stroke-width="1.4"/>`;
    }
  const last = data.at(-1);
  svg += `<line x1="0" x2="765" y1="${y(last.close)}" y2="${y(last.close)}" stroke="#719b7a" stroke-dasharray="4 4"/><rect x="770" y="${y(last.close) - 10}" width="78" height="19" rx="3" fill="#548764"/><text x="809" y="${y(last.close) + 3}" text-anchor="middle" fill="white" font-size="9">${fmt(last.close)}</text>`;
  $("#chart").innerHTML = svg;
  const meta = (b) =>
    `<strong>${symbol} · ${demo() ? interval + "m" : "CSV"}</strong><span>O ${fmt(b.open)}</span><span>H ${fmt(b.high)}</span><span>L ${fmt(b.low)}</span><span class="positive">C ${fmt(b.close)}</span><span>${new Date(b.time).toISOString().slice(0, 16).replace("T", " ")} UTC</span>`;
  $("#chart-meta").innerHTML = meta(last);
  $("#chart").onpointermove = (e) => {
    const r = e.currentTarget.getBoundingClientRect(),
      i = Math.max(
        0,
        Math.min(
          data.length - 1,
          Math.floor(
            ((((e.clientX - r.left) / r.width) * 850 - 15) / 745) * data.length,
          ),
        ),
      );
    $("#chart-meta").innerHTML = meta(data[i]);
  };
  $("#chart").onkeydown = (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      offset = Math.max(
        0,
        Math.min(
          Math.max(0, all.length - visible),
          offset + (e.key === "ArrowLeft" ? 10 : -10),
        ),
      );
      draw();
    }
  };
  $("#chart").onpointerleave = () => ($("#chart-meta").innerHTML = meta(last));
}
function equityChart(curve) {
  const lo = Math.min(...curve),
    hi = Math.max(...curve),
    range = hi - lo || 1;
  return `<figure class="equity"><figcaption>Closed-trade equity · USD</figcaption><svg viewBox="0 0 800 140" role="img" aria-label="Equity from ${money(curve[0])} to ${money(curve.at(-1))}"><line x1="0" x2="800" y1="${125 - ((0 - lo) / range) * 110}" y2="${125 - ((0 - lo) / range) * 110}" stroke="#b2c6bc" stroke-dasharray="4 4"/><polyline points="${curve.map((v, i) => `${(i / Math.max(1, curve.length - 1)) * 800},${125 - ((v - lo) / range) * 110}`).join(" ")}" fill="none" stroke="#276b4c" stroke-width="3"/></svg></figure>`;
}
function journalPage() {
  const filtered = journal.filter(
    (t) =>
      (!journalContract || t.symbol === journalContract) &&
      (!journalSide || t.direction === journalSide) &&
      (!journalFrom || t.date >= journalFrom) &&
      (!journalTo || t.date <= journalTo) &&
      (!journalOrigin || (t.source || "Manual") === journalOrigin) &&
      `${t.notes} ${t.setup || ""} ${t.emotion || ""} ${t.date} ${t.symbol}`
        .toLowerCase()
        .includes(journalFilter.toLowerCase()),
  );
  const ordered = [...filtered].sort((a, b) => a.date.localeCompare(b.date));
  const r = performance(ordered.map((t) => ({ pnl: pnl(t) })));
  $("#page").innerHTML =
    `<section class="panel page-panel"><h2>A record of your process</h2><p>Net P&L includes total trade fees. Saved in this browser. Journal edits do not change the replay account. Export a backup regularly.</p>${stats(
      [
        ["Net P&L", money(r.net)],
        ["Matching trades", filtered.length],
        ["Win rate", r.winRate.toFixed(1) + "%"],
        ["Max drawdown", money(r.drawdown)],
        ["Expectancy / trade", money(r.average)],
        [
          "Average R",
          filtered.filter((t) => t.initialRisk > 0).length
            ? (
                filtered
                  .filter((t) => t.initialRisk > 0)
                  .reduce((sum, t) => sum + pnl(t) / t.initialRisk, 0) /
                filtered.filter((t) => t.initialRisk > 0).length
              ).toFixed(2) + "R"
            : "—",
        ],
      ],
    )}${filtered.length ? equityChart(r.curve) : ""}<div class="journal-filters"><label>Search notes or date<input id="journal-search" type="search" value="${esc(journalFilter)}" placeholder="Search trades"></label><label>Contract<select id="journal-contract"><option value="">All contracts</option>${Object.keys(
      instruments,
    )
      .map(
        (v) =>
          `<option ${v === journalContract ? "selected" : ""}>${v}</option>`,
      )
      .join(
        "",
      )}</select></label><label>Direction<select id="journal-side"><option value="">All directions</option>${["Long", "Short"].map((v) => `<option ${v === journalSide ? "selected" : ""}>${v}</option>`).join("")}</select></label><label>From date<input id="journal-from" type="date" value="${journalFrom}"></label><label>To date<input id="journal-to" type="date" value="${journalTo}"></label><label>Origin<select id="journal-origin"><option value="">All trades</option><option ${journalOrigin === "Manual" ? "selected" : ""}>Manual</option><option ${journalOrigin === "Paper replay" ? "selected" : ""}>Paper replay</option></select></label><button id="export">Export all trades ↓</button></div><p>${filtered.length} of ${journal.length} trades · Equity ordered by trade date</p><div class="table-wrap"><table><thead><tr><th>DATE</th><th>CONTRACT</th><th>SIDE</th><th>ENTRY → EXIT</th><th>QTY</th><th>FEES</th><th>NET P&L</th><th>NOTES</th><th>ACTIONS</th></tr></thead><tbody>${filtered.map((t) => `<tr><td>${esc(t.date)}</td><td>${t.symbol}</td><td>${t.direction}</td><td>${fmt(t.entry)} → ${fmt(t.exit)}</td><td>${t.quantity}</td><td>${money(t.fees || 0)}</td><td class="${pnl(t) >= 0 ? "positive" : "negative"}">${money(pnl(t))}</td><td class="notes"><strong>${esc(t.setup || "Unclassified")}</strong><small>${esc(t.source || "Manual")} · ${esc(t.emotion || "No emotion recorded")} · Process ${esc(t.rating || "—")}/5${t.initialRisk > 0 ? " · " + (pnl(t) / t.initialRisk).toFixed(2) + "R" : ""}</small><p>${esc(t.notes)}</p>${t.exitReason ? `<small>Exit: ${esc(t.exitReason)}</small>` : ""}</td><td><button data-edit="${esc(t.id)}">Edit</button> <button data-delete="${esc(t.id)}">Delete</button></td></tr>`).join("")}</tbody></table>${!filtered.length ? '<div class="empty-state"><h3>No matching trades yet</h3><p>Log a closed trade or adjust your filters.</p></div>' : ""}</div></section>`;
  for (const [id, setter] of [
    ["journal-from", (v) => (journalFrom = v)],
    ["journal-to", (v) => (journalTo = v)],
    ["journal-origin", (v) => (journalOrigin = v)],
  ])
    $("#" + id).onchange = (e) => {
      setter(e.target.value);
      journalPage();
    };
  const groups = new Map();
  for (const t of filtered) {
    const name = t.setup || "Unclassified";
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(t);
  }
  $("#page .page-panel").insertAdjacentHTML(
    "beforeend",
    `<h3>Review by setup</h3><div class="table-wrap"><table><thead><tr><th>SETUP</th><th>TRADES</th><th>NET P&L</th><th>WIN RATE</th><th>EXPECTANCY</th></tr></thead><tbody>${[
      ...groups,
    ]
      .map(([name, trades]) => {
        const m = performance(trades.map((t) => ({ pnl: pnl(t) })));
        return `<tr><td>${esc(name)}</td><td>${trades.length}</td><td>${money(m.net)}</td><td>${m.winRate.toFixed(1)}%</td><td>${money(m.average)}</td></tr>`;
      })
      .join(
        "",
      )}</tbody></table></div><p>R = net P&L ÷ initial price risk, excluding costs from the denominator. Setup statistics describe this sample; they do not establish future profitability.</p>`,
  );
  $("#journal-search").oninput = (e) => {
    const pos = e.target.selectionStart;
    journalFilter = e.target.value;
    journalPage();
    $("#journal-search").focus();
    $("#journal-search").setSelectionRange(pos, pos);
  };
  $("#journal-contract").onchange = (e) => {
    journalContract = e.target.value;
    journalPage();
  };
  $("#journal-side").onchange = (e) => {
    journalSide = e.target.value;
    journalPage();
  };
  document
    .querySelectorAll("[data-edit]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          openTrade(journal.find((t) => t.id === b.dataset.edit))),
    );
  document.querySelectorAll("[data-delete]").forEach(
    (b) =>
      (b.onclick = () => {
        const removed = journal.find((t) => t.id === b.dataset.delete);
        journal = journal.filter((t) => t.id !== b.dataset.delete);
        save();
        render();
        const toastEl = $("#toast");
        toastEl.replaceChildren(document.createTextNode("Trade deleted. "));
        const undo = document.createElement("button");
        undo.textContent = "Undo";
        undo.onclick = () => {
          journal.unshift(removed);
          save();
          render();
        };
        toastEl.append(undo);
      }),
  );
  $("#export").onclick = () => {
    const rows = [
      [
        "date",
        "symbol",
        "direction",
        "entry",
        "exit",
        "quantity",
        "fees",
        "net_pnl",
        "notes",
        "setup",
        "emotion",
        "rating",
        "initial_risk",
        "source",
        "entry_time",
        "exit_time",
        "exit_reason",
      ],
      ...journal.map((t) => [
        t.date,
        t.symbol,
        t.direction,
        t.entry,
        t.exit,
        t.quantity,
        t.fees || 0,
        pnl(t),
        t.notes,
        t.setup || "",
        t.emotion || "",
        t.rating || "",
        t.initialRisk || "",
        t.source || "Manual",
        t.entryTime ? new Date(t.entryTime).toISOString() : "",
        t.exitTime ? new Date(t.exitTime).toISOString() : "",
        t.exitReason || "",
      ]),
    ];
    download(
      "trade-rehearsal-journal.csv",
      rows
        .map((row) =>
          row
            .map(
              (v) =>
                '"' +
                String(v)
                  .replace(/"/g, '""')
                  .replace(/^[=+@-]/, "'$&") +
                '"',
            )
            .join(","),
        )
        .join("\n"),
    );
  };
}
function labPage() {
  $("#page").innerHTML =
    `<section class="panel page-panel"><div class="card-heading"><h2>Moving-average crossover</h2><span class="badge">${symbol} · ${demo() ? "DEMO" : "CSV"}</span></div><p>Choose long, short, or both directions. Signals execute at the next bar’s open.</p><form id="backtest-form" class="backtest-form">${[
      ["fast", "Fast SMA (bars)", 9, 2, 1],
      ["slow", "Slow SMA (bars)", 21, 3, 1],
      ["quantity", "Contracts", 1, 1, 1],
      ["commission", "Round-trip fees / contract ($)", 1.24, 0, 0.01],
      ["slippage", "Slippage per side (ticks)", 1, 0, 1],
    ]
      .map(
        ([name, label, value, min, step]) =>
          `<label>${label}<input name="${name}" type="number" min="${min}" step="${step}" value="${value}" required></label>`,
      )
      .join(
        "",
      )}<label>Trade direction<select name="direction"><option value="long">Long only</option><option value="short">Short only</option><option value="both">Long and short</option></select></label><button class="primary">Run backtest →</button></form><p class="help">Signals use completed bars and execute at the next open. Open positions close at the final close. P&L includes contract point values, commissions, and slippage. Drawdown uses closed-trade equity. No margin, rollover, or liquidity modeling. ${demo() ? "Synthetic outcomes are illustrative. Import real contract history for meaningful research." : "Verify your data’s contract and rollover conventions."}</p><div id="results" aria-live="polite"></div></section>`;
  for (const [k, v] of Object.entries(labSettings))
    $("#backtest-form").elements.namedItem(k).value = v;
  $("#backtest-form").onsubmit = (e) => {
    e.preventDefault();
    const settings = Object.fromEntries(
      [...new FormData(e.target)].map(([k, v]) => [
        k,
        k === "direction" ? v : Number(v),
      ]),
    );
    Object.assign(labSettings, settings);
    settings.point = instruments[symbol].point;
    settings.slippage *= instruments[symbol].tick;
    try {
      const r = backtest(bars(), settings);
      $("#results").innerHTML =
        stats([
          ["Net P&L", money(r.net)],
          ["Closed trades", r.trades.length],
          ["Win rate", r.winRate.toFixed(1) + "%"],
          ["Max drawdown", money(r.drawdown)],
          ["Average trade", money(r.average)],
          [
            "Profit factor",
            r.profitFactor === null
              ? "—"
              : r.profitFactor === Infinity
                ? "No losses"
                : r.profitFactor.toFixed(2),
          ],
        ]) +
        equityChart(r.curve) +
        `<button id="export-backtest">Export results CSV ↓</button><div class="table-wrap"><table><thead><tr><th>ENTRY TIME (UTC)</th><th>EXIT TIME (UTC)</th><th>SIDE</th><th>ENTRY</th><th>EXIT</th><th>NET P&L</th></tr></thead><tbody>${r.trades.map((t) => `<tr><td>${new Date(t.time).toISOString().slice(0, 16).replace("T", " ")}</td><td>${new Date(t.exitTime).toISOString().slice(0, 16).replace("T", " ")}</td><td>${t.direction}</td><td>${fmt(t.entry)}</td><td>${fmt(t.exit)}</td><td class="${t.pnl >= 0 ? "positive" : "negative"}">${money(t.pnl)}</td></tr>`).join("")}</tbody></table></div>${r.trades.length ? "" : "<p>No trades in this history. Try other periods or import more data.</p>"}`;
      $("#export-backtest").onclick = () =>
        download(
          symbol + "-backtest.csv",
          "entry_time,exit_time,direction,entry,exit,net_pnl\n" +
            r.trades
              .map((t) =>
                [
                  new Date(t.time).toISOString(),
                  new Date(t.exitTime).toISOString(),
                  t.direction,
                  t.entry,
                  t.exit,
                  t.pnl,
                ].join(","),
              )
              .join("\n"),
        );
    } catch (err) {
      $("#results").textContent = err.message;
    }
  };
}
function dataPage() {
  $("#page").innerHTML =
    `<section class="panel page-panel"><h2>Your data, with context</h2><p>TradingView provides embedded market charts. Trade Rehearsal’s own charts and backtests use synthetic or imported bars.</p><div class="data-summary"><strong>${symbol} research dataset</strong><p>${bars().length} bars · ${demo() ? "Synthetic example" : "Imported CSV"} · ${new Date(bars()[0].time).toISOString().slice(0, 10)} to ${new Date(bars().at(-1).time).toISOString().slice(0, 10)} UTC</p></div><div class="source-grid"><div class="source"><span class="badge">READY TO USE</span><h3>Import historical CSV</h3><p>Load ${symbol} bars into the chart and strategy lab. Select the contract above before importing. Data stays in memory until reload. Maximum 5 MB and 20,000 bars.</p><label>CSV for ${symbol}<input id="csv" type="file" accept=".csv,text/csv"></label><p class="help">Header: time,open,high,low,close,volume<br>Use ISO timestamps with timezone, ascending rows, and decimal prices. Volume is optional. Contract metadata is not verified.</p><button id="example">Download example CSV ↓</button><p id="import-status" role="status" class="error"></p>${imports[symbol] ? '<button id="clear">Return to demo data</button>' : ""}</div><div class="source"><span class="badge">FREE DATA · LIMITATIONS APPLY</span><h3>Finding futures history</h3><p>Real-time and extensive intraday MNQ, MES, and MGC data typically require exchange permissions or paid access. Free sources can be delayed, limited, or tied to a brokerage account.</p><p>Yahoo Finance has futures references NQ=F, ES=F, and GC=F. These are larger-contract proxies, not micro-contract executions. This prototype does not connect to Yahoo. TradingView charts are a separate display and cannot supply bars to the strategy lab.</p><a href="https://finance.yahoo.com/commodities/" target="_blank" rel="noopener noreferrer">Explore Yahoo futures references ↗</a><p>CME publishes specifications and market data information. Review licensing and provider terms before downloading or redistributing data.</p><a href="https://www.cmegroup.com/market-data.html" target="_blank" rel="noopener noreferrer">CME market data information ↗</a></div></div></section>`;
  $("#example").onclick = () =>
    download(
      symbol + "-demo.csv",
      "time,open,high,low,close,volume\n" +
        sample(symbol, interval)
          .map((b) =>
            [
              new Date(b.time).toISOString(),
              b.open,
              b.high,
              b.low,
              b.close,
              b.volume,
            ].join(","),
          )
          .join("\n"),
    );
  $("#csv").onchange = async (e) => {
    const f = e.target.files[0],
      importSymbol = symbol;
    if (!f) return;
    try {
      if (f.size > 5 * 1024 * 1024)
        throw Error("Choose a file smaller than 5 MB.");
      const b = parseCSV(await f.text());
      if (b.length > 20000) throw Error("Import at most 20,000 bars.");
      imports[importSymbol] = b;
      symbol = importSymbol;
      chartSource = "local";
      visible = 90;
      offset = 0;
      toast(`Imported ${b.length} ${symbol} bars`);
      go("chart");
    } catch (err) {
      if ($("#import-status")) $("#import-status").textContent = err.message;
      else toast(err.message);
    }
  };
  if ($("#clear"))
    $("#clear").onclick = () => {
      delete imports[symbol];
      render();
    };
}
$("#trade-form").elements.symbol.innerHTML = Object.keys(instruments)
  .map((s) => `<option>${s}</option>`)
  .join("");
$("#mobile-route").onchange = (e) => go(e.target.value);
document
  .querySelectorAll("[data-page]")
  .forEach((b) => (b.onclick = () => go(b.dataset.page)));
function openTrade(t) {
  editingId = t?.id || null;
  const f = $("#trade-form");
  f.reset();
  f.elements.symbol.value = symbol;
  f.elements.date.value = new Date().toLocaleDateString("en-CA");
  if (t)
    for (const [key, value] of Object.entries(t))
      if (f.elements.namedItem(key)) f.elements.namedItem(key).value = value;
  $("#trade-dialog h2").textContent = t ? "Edit trade" : "Log a trade";
  $("#trade-dialog").showModal();
}
$("#log-trade").onclick = () => openTrade();
$("#close-dialog").onclick = () => $("#trade-dialog").close();
$("#trade-form").onsubmit = (e) => {
  e.preventDefault();
  const t = Object.fromEntries(new FormData(e.target));
  for (const k of ["entry", "exit", "quantity", "fees"]) t[k] = Number(t[k]);
  if (!(
    t.entry > 0 &&
    t.exit > 0 &&
    Number.isInteger(t.quantity) &&
    t.quantity > 0 &&
    Number.isFinite(t.fees) &&
    t.fees >= 0
  ))
    return;
  t.initialRisk = Number(t.initialRisk) || 0;
  const prior = journal.find((old) => old.id === editingId);
  if (prior)
    ((t.source = prior.source),
      (t.entryTime = prior.entryTime),
      (t.exitTime = prior.exitTime),
      (t.exitReason = prior.exitReason));
  t.id = editingId || crypto.randomUUID();
  if (editingId)
    journal = journal.map((old) => (old.id === editingId ? t : old));
  else journal.unshift(t);
  editingId = null;
  save();
  $("#trade-dialog").close();
  render();
};
const route = () => {
  const requested = location.hash.slice(1);
  page = Object.hasOwn(titles, requested) ? requested : "start";
  render();
};
window.addEventListener("popstate", route);
route();

function chartPage() {
  const toolbar = `<div class="source-toolbar"><div><strong>Chart source</strong><span>Market view or your research data</span></div><div class="source-toggle" role="group" aria-label="Chart source"><button id="source-tv" class="${chartSource === "tradingview" ? "active" : ""}" aria-pressed="${chartSource === "tradingview"}">TradingView</button><button id="source-local" class="${chartSource === "local" ? "active" : ""}" aria-pressed="${chartSource === "local"}">Demo / imported CSV</button></div></div>`;
  if (chartSource === "local") {
    localChartPage();
    $("#page").insertAdjacentHTML("afterbegin", toolbar);
  } else {
    $("#page").innerHTML =
      toolbar +
      `<section class="panel"><div class="chart-title"><strong>${symbol} · TradingView</strong><span class="badge">EXTERNAL CHART</span></div><div class="tv-notice">Quotes are supplied by TradingView and may be delayed or unavailable for this contract. Exchange access rules apply. The cards above show separate demo/CSV prices, not TradingView quotes.</div><div id="tv-host" class="tv-host"></div><div id="tv-status" class="tv-notice" role="status">If the chart is blank or the symbol is unavailable, <a href="https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tradingViewSymbols[symbol])}" target="_blank" rel="noopener noreferrer">open it on TradingView ↗</a> or select Demo / imported CSV.</div></section><div class="lower-grid"><section class="panel lower-card"><h3>Keep your journal beside your process</h3><p class="lab-description">Log trades with the button above. Your journal is saved in this browser; TradingView chart settings are managed separately.</p><button class="text-button" data-go="journal">Open trade journal →</button></section><section class="panel lower-card"><h3>Backtesting uses your research data</h3><p class="lab-description">TradingView’s free widget does not share historical bars with Trade Rehearsal. Import a CSV to test your strategy on real history.</p><button class="text-button" data-go="data">Import historical data →</button></section></div>`;
    mountTradingView($("#tv-host"), symbol, () => {
      const status = $("#tv-status");
      if (status)
        status.insertAdjacentHTML(
          "afterbegin",
          "<strong>TradingView could not load. Check your connection or content blocker.</strong><br>",
        );
    });
  }
  $("#source-tv").onclick = () => {
    chartSource = "tradingview";
    render();
  };
  $("#source-local").onclick = () => {
    chartSource = "local";
    render();
  };
}
