const escape = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function impactContext(text) {
  const t = text.toLowerCase();
  if (/inflation|consumer price|producer price|pce|cpi/.test(t))
    return {
      topic: "Inflation",
      markets: "MNQ · MES · MGC · bonds / USD",
      context:
        "An upside inflation surprise can raise expected policy rates and yields, pressuring equity valuations. A downside surprise can reverse that channel. Gold also depends on real yields, the dollar, and risk demand.",
      watch:
        "Compare actual with consensus and revisions; confirm yields and USD reaction. A hot number alone is not a sell signal.",
    };
  if (/fomc|monetary|federal funds|interest rate|policy rate/.test(t))
    return {
      topic: "Monetary policy",
      markets: "MNQ · MES · MGC · USD",
      context:
        "A policy stance tighter than expected can pressure rate-sensitive equities; a looser stance can support them. Gold responses depend partly on real yields and USD, and on whether easing reflects growth stress.",
      watch:
        "Separate the rate decision from guidance and the press conference; watch the market reaction rather than the headline alone.",
    };
  if (/employment|payroll|labor|labour|unemployment|jobs|wages/.test(t))
    return {
      topic: "Labor market",
      markets: "MES · MNQ · MGC",
      context:
        "Stronger labor data can support earnings expectations while also lifting rate expectations. Weak labor data can increase easing expectations but raise growth concerns. Those channels can offset each other.",
      watch:
        "Check wage growth, participation, revisions, and yields. The direction is conditional, not mechanically bullish or bearish.",
    };
  if (/gdp|gross domestic|income|spending|retail|trade|economic growth/.test(t))
    return {
      topic: "Growth & demand",
      markets: "MES · MNQ · cyclical stocks",
      context:
        "Stronger demand can support revenue expectations but may change inflation and rate expectations. Weak growth may pressure earnings while encouraging policy easing.",
      watch:
        "Check real versus nominal growth, revisions, and whether markets focus on rates or earnings.",
    };
  if (/earnings|profit|revenue|tech|chip|nvidia|apple/.test(t))
    return {
      topic: "Company / technology",
      markets: "Individual stocks · MNQ · MES",
      context:
        "A company surprise may affect its share price and related sectors. Index impact depends on company weight and whether the news changes broader earnings expectations.",
      watch:
        "Compare guidance with expectations and distinguish company-specific moves from index-wide breadth.",
    };
  return {
    topic: "Broader context",
    markets: "Instrument relevance must be assessed",
    context:
      "This headline has no reliable automatic directional mapping. Relevance depends on the event details, expectations, positioning, and the trading horizon.",
    watch:
      "Read the original source and check whether price, volume, yields, or USD confirm a meaningful reaction.",
  };
}
export async function mountIntelligence(host) {
  host.innerHTML =
    '<section class="panel page-panel"><h2>Multi-source briefing</h2><p role="status">Loading publisher snapshots…</p></section>';
  try {
    const response = await fetch("./data/briefing.json", { cache: "no-cache" });
    if (!response.ok) throw Error("Snapshot unavailable");
    const data = await response.json();
    if (!host.isConnected) return;
    const fetched = new Date(data.generatedAt),
      age = (Date.now() - fetched.getTime()) / 3600000;
    host.innerHTML = `<section class="panel page-panel"><div class="card-heading"><h2>Multi-source briefing</h2><span class="badge">PUBLISHER SNAPSHOT</span></div><p>Fetched ${escape(fetched.toLocaleString())}. ${age > 2 ? "This snapshot is older than two hours; check original sources for updates." : "Read publication dates below; the newest feed retrieval may contain older releases."}</p><p>Headlines and short official-source extracts are followed by rule-based educational context. Context describes possible channels, not a verified surprise, individualized advice, or an estimated market probability.</p><div class="source-health">${data.sources.map((s) => `<a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer">${escape(s.name)} · ${s.status === "ok" ? s.count + " items" : "unavailable"}</a>`).join("")}</div><div class="macro-controls"><label>Source<select id="brief-source"><option value="">All publishers</option>${data.sources.map((s) => `<option>${escape(s.name)}</option>`).join("")}</select></label><label>Search briefing<input id="brief-search" type="search" placeholder="Inflation, rates, jobs…"></label></div><div id="brief-cards" class="brief-cards"></div></section>`;
    const render = () => {
      const source = host.querySelector("#brief-source").value,
        query = host.querySelector("#brief-search").value.toLowerCase(),
        items = data.items.filter(
          (i) =>
            (!source || i.source === source) &&
            `${i.title} ${i.summary}`.toLowerCase().includes(query),
        );
      host.querySelector("#brief-cards").innerHTML =
        items
          .map((item) => {
            const impact = impactContext(item.title + " " + item.summary);
            let link;
            try {
              link = new URL(item.url);
              if (link.protocol !== "https:") return "";
            } catch {
              return "";
            }
            return `<article class="brief-card"><div class="card-heading"><span class="badge">${escape(item.source)} · ${impact.topic}</span><time>${item.publishedAt ? escape(new Date(item.publishedAt).toLocaleString()) : "Publication time unavailable"}</time></div><h3><a href="${escape(link.href)}" target="_blank" rel="noopener noreferrer">${escape(item.title)} ↗</a></h3>${item.summary ? `<p>${escape(item.summary)}</p>` : ""}<details class="impact-note"><summary>Possible market impact · ${impact.topic}</summary><strong>${impact.markets}</strong><p>${impact.context}</p><p><b>What to verify:</b> ${impact.watch}</p><small>Directional confidence: unestimated · No numeric forecast produced.</small></details></article>`;
          })
          .join("") ||
        "<p>No matching headlines. Change the source or search.</p>";
    };
    host.querySelector("#brief-source").onchange = render;
    host.querySelector("#brief-search").oninput = render;
    render();
  } catch {
    if (host.isConnected)
      host.innerHTML =
        '<section class="panel page-panel"><h2>Multi-source briefing</h2><p role="status">The publisher snapshot could not load. Use the source links and calendar while the feed is unavailable.</p><a href="https://www.federalreserve.gov/newsevents.htm" target="_blank" rel="noopener noreferrer">Federal Reserve ↗</a> · <a href="https://www.bea.gov/news" target="_blank" rel="noopener noreferrer">BEA ↗</a> · <a href="https://www.bbc.com/news/business" target="_blank" rel="noopener noreferrer">BBC Business ↗</a></section>';
  }
}
export function mountScenarios(host) {
  const date = new Date().toLocaleDateString("en-CA"),
    key = "satary-scenarios-" + date;
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(key) || "{}") || {};
  } catch {}
  host.innerHTML = `<section class="panel page-panel scenario-panel"><h2>Scenario notebook · ${date}</h2><p>Assign your own subjective odds for one instrument and horizon. These are planning assumptions, not Satary forecasts. Probabilities must total 100%; news context above does not calculate them.</p><form id="scenario-form"><div class="form-grid"><label>Instrument<input name="instrument" value="${escape(saved.instrument || "MNQ")}" maxlength="30" required></label><label>Horizon<input name="horizon" value="${escape(saved.horizon || "Next session")}" maxlength="80" required></label></div><div class="scenario-grid">${[
    ["bull", "Bullish"],
    ["base", "Range / mixed"],
    ["bear", "Bearish"],
  ]
    .map(
      ([name, label]) =>
        `<label>${label} odds (%)<input name="${name}" type="number" min="0" max="100" step="1" value="${escape(saved[name] ?? "")}" required></label>`,
    )
    .join(
      "",
    )}</div><label>Evidence, triggers, and invalidation<textarea name="evidence" rows="3" maxlength="5000" required placeholder="What would confirm each scenario? What would change your view?">${escape(saved.evidence || "")}</textarea></label><button class="primary">Save subjective scenarios</button><p id="scenario-status" role="status"></p></form></section>`;
  host.querySelector("#scenario-form").onsubmit = (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target)),
      total = +data.bull + +data.base + +data.bear,
      status = host.querySelector("#scenario-status");
    if (
      [data.bull, data.base, data.bear].some(
        (v) => !Number.isInteger(+v) || +v < 0 || +v > 100,
      )
    ) {
      status.textContent = "Use whole probabilities between 0% and 100%.";
      return;
    }
    if (total !== 100) {
      status.textContent = `Odds total ${total}%. Adjust them to total 100%.`;
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(data));
      status.textContent =
        "Subjective scenarios saved for today. These odds are not model-calibrated.";
    } catch {
      status.textContent =
        "Storage unavailable. Copy your scenarios into downloaded briefing notes.";
    }
  };
}
