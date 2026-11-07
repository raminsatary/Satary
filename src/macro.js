import { mountIntelligence, mountScenarios } from "./intelligence.js";
// External feeds stay separate from Satary's local research and journal data.
const externalLink = (url, label) =>
  `<a href="${url}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`;
function mountFeed(host, kind, config) {
  const widget = document.createElement("div");
  widget.className = "tradingview-widget-container";
  const body = document.createElement("div");
  body.className = "tradingview-widget-container__widget";
  widget.append(body);
  const attribution = document.createElement("div");
  attribution.className = "tradingview-widget-copyright";
  attribution.innerHTML = externalLink(
    kind === "events"
      ? "https://www.tradingview.com/economic-calendar/"
      : "https://www.tradingview.com/news/",
    kind === "events"
      ? "Economic calendar by TradingView"
      : "News by TradingView",
  );
  widget.append(attribution);
  const script = document.createElement("script");
  script.src = `https://s3.tradingview.com/external-embedding/embed-widget-${kind}.js`;
  script.async = true;
  script.textContent = JSON.stringify({
    width: "100%",
    height: "100%",
    colorTheme: "light",
    isTransparent: false,
    locale: "en",
    ...config,
  });
  script.onerror = () => {
    if (host.isConnected) {
      const status = host.parentElement.querySelector('[role="status"]');
      status.textContent =
        "The external feed could not load. Use the source links below, then retry.";
    }
  };
  widget.append(script);
  host.replaceChildren(widget);
}
export function calendarPage(container) {
  container.innerHTML = `<section class="panel page-panel"><div class="card-heading"><h2>Economic calendar</h2><span class="badge">EXTERNAL FEED</span></div><p>Track scheduled releases before planning your session. Times, forecasts, actuals, and revisions are provided by TradingView; check the timezone displayed in the widget.</p><div class="macro-controls"><label>Economies<select id="calendar-country"><option value="us">United States</option><option value="us,ca">United States & Canada</option><option value="">All economies</option></select></label><label>Importance<select id="calendar-impact"><option value="0,1">Medium & high</option><option value="1">High only</option><option value="-1,0,1">All events</option></select></label><button id="calendar-refresh">Reload calendar ↻</button></div><div class="macro-feed calendar-feed" id="calendar-feed" aria-label="TradingView economic calendar"></div><p class="help" role="status">If the calendar is blank, your browser may be blocking third-party content. Open the calendar or official schedules below.</p><div class="source-links">${externalLink("https://www.tradingview.com/economic-calendar/", "Full calendar")}${externalLink("https://www.bls.gov/schedule/news_release/", "BLS releases")}${externalLink("https://www.bea.gov/news/schedule", "BEA releases")}${externalLink("https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm", "Federal Reserve meetings")}</div></section><section class="panel lower-card macro-context"><h3>Prepare around the release</h3><p>Review inflation, employment, growth, and central bank announcements. Record the releases relevant to MNQ, MES, or MGC in your briefing, then compare the published figures with expectations.</p><button data-go="news" class="text-button">Write your session briefing →</button></section>`;
  const country = container.querySelector("#calendar-country"),
    impact = container.querySelector("#calendar-impact");
  const load = () =>
    mountFeed(container.querySelector("#calendar-feed"), "events", {
      countryFilter: country.value,
      importanceFilter: impact.value,
    });
  country.onchange = load;
  impact.onchange = load;
  container.querySelector("#calendar-refresh").onclick = load;
  load();
}
export function newsPage(container) {
  const today = new Date().toLocaleDateString("en-CA");
  container.innerHTML = `<div id="intelligence-space"></div><div class="briefing-layout"><section class="panel page-panel"><div class="card-heading"><h2>Market headlines</h2><span class="badge">TRADINGVIEW</span></div><p>Read the latest available reporting from the external feed. Publication times and coverage are supplied by the provider.</p><div class="macro-controls"><label>Coverage<select id="news-market"><option value="stock">Equities</option><option value="forex">Currencies</option><option value="futures">Futures</option></select></label><button id="news-refresh">Reload headlines ↻</button></div><div class="macro-feed news-feed" id="news-feed" aria-label="TradingView market news"></div><p class="help" role="status">If headlines are unavailable, use the news sources below. Satary does not generate or verify these headlines.</p><div class="source-links">${externalLink("https://www.tradingview.com/news/", "All market news")}${externalLink("https://www.federalreserve.gov/newsevents.htm", "Federal Reserve news")}${externalLink("https://www.bls.gov/bls/newsrels.htm", "BLS releases")}</div></section><section class="panel page-panel briefing-notes"><h2>Your session briefing</h2><p>Personal notes, saved on this device by date. This is your research space; it is not an automatically generated news summary.</p><form id="briefing-form"><label>Session date<input id="briefing-date" type="date" value="${today}" required></label><label>Key catalysts<textarea name="catalysts" rows="4" maxlength="12000" placeholder="Releases, central bank speakers, earnings, and source links…"></textarea></label><label>Market context & scenarios<textarea name="context" rows="4" maxlength="12000" placeholder="What matters for MNQ, MES, and MGC? What would change your view?"></textarea></label><label>Session plan<textarea name="plan" rows="4" maxlength="12000" placeholder="Levels to watch, risk limits, and times to reassess…"></textarea></label><div class="briefing-actions"><button class="primary" type="submit">Save briefing</button><button id="briefing-export" type="button">Download notes ↓</button></div><p id="briefing-status" role="status" aria-live="polite"></p></form><button data-go="calendar" class="text-button">Review the economic calendar →</button></section></div>`;
  const market = container.querySelector("#news-market");
  const load = () =>
    mountFeed(container.querySelector("#news-feed"), "timeline", {
      feedMode: "market",
      market: market.value,
      displayMode: "regular",
    });
  market.onchange = load;
  container.querySelector("#news-refresh").onclick = load;
  load();
  const form = container.querySelector("#briefing-form"),
    date = container.querySelector("#briefing-date"),
    status = container.querySelector("#briefing-status"),
    fields = ["catalysts", "context", "plan"];
  let activeDate = date.value,
    dirty = false;
  const key = () => `satary-briefing-${activeDate}`;
  function read() {
    let notes = {};
    try {
      notes = JSON.parse(localStorage.getItem(key()) || "{}") || {};
    } catch {
      status.textContent =
        "Saved notes could not be read. You can still write and download a briefing.";
    }
    fields.forEach(
      (field) =>
        (form.elements.namedItem(field).value =
          typeof notes[field] === "string" ? notes[field] : ""),
    );
    dirty = false;
  }
  function save() {
    try {
      localStorage.setItem(
        key(),
        JSON.stringify(
          Object.fromEntries(
            fields.map((field) => [
              field,
              form.elements.namedItem(field).value,
            ]),
          ),
        ),
      );
      dirty = false;
      status.textContent = `Saved for ${activeDate} on this device.`;
      return true;
    } catch {
      status.textContent =
        "Browser storage is unavailable or full. Download your notes to keep a copy.";
      return false;
    }
  }
  fields.forEach(
    (field) =>
      (form.elements.namedItem(field).oninput = () => {
        dirty = true;
        save();
      }),
  );
  form.onsubmit = (e) => {
    e.preventDefault();
    save();
  };
  date.onchange = () => {
    if (!date.value) {
      date.value = activeDate;
      return;
    }
    if (dirty && !save()) {
      date.value = activeDate;
      return;
    }
    activeDate = date.value;
    status.textContent = "";
    read();
  };
  container.querySelector("#briefing-export").onclick = () => {
    const text =
      `Satary session briefing — ${activeDate}\n\n` +
      fields
        .map(
          (field) =>
            `${{ catalysts: "Key catalysts", context: "Market context & scenarios", plan: "Session plan" }[field]}\n${form.elements.namedItem(field).value}`,
        )
        .join("\n\n");
    const url = URL.createObjectURL(
        new Blob([text], { type: "text/plain;charset=utf-8" }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = `satary-briefing-${activeDate}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  read();
  const scenarios = document.createElement("div");
  container.append(scenarios);
  mountScenarios(scenarios);
  mountIntelligence(container.querySelector("#intelligence-space"));
}
