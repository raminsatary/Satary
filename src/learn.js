import { instruments } from "./engine.js";
import { tradingViewSymbols } from "./tradingview.js";
const safe = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const lessons = [
  [
    "Read the instrument",
    "MNQ and MES track equity indexes through futures; MGC is a gold futures contract. They are contracts, not individual stocks. A stock order uses shares. A futures order uses contracts, and its point value determines P&L.",
    "Example: MNQ moves 10 points × $2 per point × 1 contract = $20 gross. A 0.25-point tick is $0.50.",
    "https://www.cmegroup.com/education/courses/micro-e-mini-futures.html",
    "CME micro futures education",
  ],
  [
    "Understand the chart",
    "A candle shows open, high, low, and close for a time interval. Rising prices alone do not tell you the risk of a trade. Inspect the timeframe, source, timestamp, and whether prices are delayed or simulated.",
    "In practice replay you only see revealed bars. Press Next bar to observe what happens after your decision.",
    "https://www.investor.gov/introduction-investing/investing-basics",
    "Investor.gov investing basics",
  ],
  [
    "Plan an order",
    "A market order seeks execution but not a guaranteed price. A limit order sets a price constraint and may never fill. A stop entry activates after a threshold; a stop loss exits a position. Stops can slip through gaps.",
    "Write an entry, an invalidation price (stop), a target, and position size before placing a demo order.",
    "https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/types-orders",
    "Investor.gov order types",
  ],
  [
    "Size the risk",
    "Risk depends on stop distance, instrument point value, quantity, fees, and slippage. Leverage magnifies both gains and losses. Training margin is a simplified reserve, not a broker or exchange requirement.",
    "Risk budget ÷ per-unit risk gives the maximum whole quantity. Start with one contract and learn how a stop changes your risk.",
    "https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/FuturesMarketBasics/index.htm",
    "CFTC futures basics",
  ],
  [
    "Review the context",
    "Economic releases, interest-rate expectations, company results, and unexpected events can affect prices. A headline alone rarely determines direction; the surprise relative to expectations and the market reaction matter.",
    "Check the calendar, read more than one source, and write both a bullish and bearish scenario with invalidation conditions.",
    "https://www.federalreserve.gov/monetarypolicy.htm",
    "Federal Reserve monetary policy",
  ],
  [
    "Reflect on the process",
    "A winning trade can break your rules; a losing trade can follow a sound plan. Review execution, risk, and discipline separately from P&L. Small samples do not establish an edge.",
    "After a demo trade closes, add the setup, emotion, process rating, and lesson to its journal entry. Review average R and the results by setup.",
    "https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins",
    "Investor education resources",
  ],
];
export function learnPage(container) {
  let done = [];
  try {
    const d = JSON.parse(localStorage.getItem("satary-learning") || "[]");
    if (Array.isArray(d)) done = d;
  } catch {}
  container.innerHTML = `<section class="welcome-panel"><span class="eyebrow">START SMALL. BUILD A PROCESS.</span><h2>Your first trading workspace.</h2><p>Learn the basics, watch the market, make a plan, practice with virtual funds, then review the decision. You can complete this path without connecting a broker or depositing money.</p><div class="welcome-actions"><button class="primary" data-go="practice">Start demo practice →</button><button data-go="markets">Explore markets</button></div></section><div class="journey-strip"><span>1 · Learn</span><span>2 · Observe</span><span>3 · Plan</span><span>4 · Practice</span><span>5 · Reflect</span></div><section class="panel page-panel"><div class="card-heading"><h2>A practical first-session path</h2><span id="learning-progress">${done.length} / ${lessons.length} completed</span></div><div class="lesson-grid">${lessons.map(([title, body, task, url, label], i) => `<article class="lesson-card"><span class="lesson-number">0${i + 1}</span><h3>${title}</h3><p>${body}</p><div class="lesson-task">${task}</div><a href="${url}" target="_blank" rel="noopener noreferrer">${label} ↗</a><label class="check-label"><input type="checkbox" data-lesson="${i}" ${done.includes(i) ? "checked" : ""}> I’ve practiced this step</label></article>`).join("")}</div><p id="learning-status" role="status"></p></section><section class="panel page-panel risk-school"><h2>Position sizing calculator</h2><p>Educational estimate using your inputs. Actual fills, fees, and risk can differ.</p><form id="sizing-form" class="sizing-grid"><label>Instrument<select name="symbol">${Object.keys(
    instruments,
  )
    .map((s) => `<option>${s}</option>`)
    .join(
      "",
    )}</select></label><label>Account size ($)<input name="balance" type="number" min="1" value="25000" step="any" required></label><label>Risk budget (%)<input name="risk" type="number" min="0.01" max="5" value="1" step="0.01" required></label><label>Stop distance (points)<input name="distance" type="number" min="0.01" value="20" step="any" required></label><label>Round-trip costs / unit ($)<input name="cost" type="number" min="0" value="2.24" step="any" required></label><button class="primary">Calculate size</button></form><p id="sizing-result" role="status">Choose your stop distance before choosing your quantity.</p></section>`;
  container.querySelectorAll("[data-lesson]").forEach(
    (input) =>
      (input.onchange = () => {
        const id = +input.dataset.lesson;
        done = input.checked
          ? [...new Set([...done, id])]
          : done.filter((n) => n !== id);
        container.querySelector("#learning-progress").textContent =
          `${done.length} / ${lessons.length} completed`;
        try {
          localStorage.setItem("satary-learning", JSON.stringify(done));
        } catch {
          container.querySelector("#learning-status").textContent =
            "Progress cannot be saved in this browser.";
        }
      }),
  );
  container.querySelector("#sizing-form").onsubmit = (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target)),
      perUnit = +d.distance * instruments[d.symbol].point + +d.cost,
      budget = (+d.balance * +d.risk) / 100;
    container.querySelector("#sizing-result").textContent =
      `Budget $${budget.toFixed(2)} ÷ estimated unit risk $${perUnit.toFixed(2)} = ${Math.floor(budget / perUnit)} whole ${instruments[d.symbol].kind === "future" ? "contracts" : "shares"}. This excludes margin constraints.`;
  };
}
export function marketsPage(container, { onSelect } = {}) {
  container.innerHTML = `<section class="panel page-panel"><div class="card-heading"><h2>Market watch</h2><span class="badge">PROVIDER QUOTES</span></div><p>Provider-supplied quotes may be delayed or unavailable. Check the provider’s displayed timestamp and session. These prices do not drive the replay simulator.</p><div id="market-quotes" class="macro-feed"></div><p class="help" id="quotes-status" role="status">If the quotes cannot load, <a href="https://www.tradingview.com/markets/" target="_blank" rel="noopener noreferrer">open TradingView markets ↗</a>. No programmatic live-price feed is connected to demo orders.</p></section><section class="panel page-panel market-picker"><h2>Choose your research instrument</h2><div class="macro-controls"><label>Search name or symbol<input id="market-search" type="search" placeholder="MNQ, gold, Apple…"></label><label>Asset class<select id="market-class"><option value="">All</option><option value="future">Futures</option><option value="stock">Stocks</option><option value="etf">ETFs</option></select></label></div><div id="market-results" class="instrument-grid"></div><p>Need a different symbol? Use symbol search inside the external chart. Replay currently supports the listed instruments; CSV imports must match the selected instrument.</p></section>`;
  const wrapper = document.createElement("div");
  wrapper.className = "tradingview-widget-container";
  const body = document.createElement("div");
  body.className = "tradingview-widget-container__widget";
  wrapper.append(body);
  const credit = document.createElement("div");
  credit.className = "tradingview-widget-copyright";
  credit.innerHTML =
    '<a href="https://www.tradingview.com/markets/" target="_blank" rel="noopener noreferrer">Market quotes by TradingView ↗</a>';
  wrapper.append(credit);
  const script = document.createElement("script");
  script.src =
    "https://s3.tradingview.com/external-embedding/embed-widget-market-quotes.js";
  script.async = true;
  script.textContent = JSON.stringify({
    width: "100%",
    height: "100%",
    colorTheme: "light",
    locale: "en",
    isTransparent: false,
    symbolsGroups: [
      {
        name: "Micro futures",
        symbols: Object.entries(instruments)
          .filter(([, i]) => i.kind === "future")
          .map(([s]) => ({ name: tradingViewSymbols[s], displayName: s })),
      },
      {
        name: "Stocks & ETFs",
        symbols: Object.entries(instruments)
          .filter(([, i]) => i.kind !== "future")
          .map(([s]) => ({ name: tradingViewSymbols[s], displayName: s })),
      },
    ],
  });
  script.onerror = () => {
    if (container.isConnected)
      container
        .querySelector("#quotes-status")
        .insertAdjacentText("afterbegin", "The quote widget could not load. ");
  };
  wrapper.append(script);
  container.querySelector("#market-quotes").append(wrapper);
  function list() {
    const term = container.querySelector("#market-search").value.toLowerCase(),
      kind = container.querySelector("#market-class").value,
      items = Object.entries(instruments).filter(
        ([s, i]) =>
          (!kind || kind === i.kind) &&
          `${s} ${i.name}`.toLowerCase().includes(term),
      );
    container.querySelector("#market-results").innerHTML =
      items
        .map(
          ([s, i]) =>
            `<article class="instrument-card"><span class="badge">${i.kind.toUpperCase()}</span><h3>${s}</h3><p>${safe(i.name)}</p><p>Tick ${i.tick} · $${(i.tick * i.point).toFixed(2)} / tick / unit</p><button data-research="${s}">Open chart →</button><button data-replay="${s}">Practice →</button></article>`,
        )
        .join("") || "<p>No instruments match your search.</p>";
    container
      .querySelectorAll("[data-research]")
      .forEach(
        (b) => (b.onclick = () => onSelect(b.dataset.research, "chart")),
      );
    container
      .querySelectorAll("[data-replay]")
      .forEach(
        (b) => (b.onclick = () => onSelect(b.dataset.replay, "practice")),
      );
  }
  container.querySelector("#market-search").oninput = list;
  container.querySelector("#market-class").onchange = list;
  list();
}
