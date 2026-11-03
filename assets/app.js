const state = { index: null, municipality: null, selectedMetric: null };
const $ = (id) => document.getElementById(id);

const fmt = {
  one: (value) => value == null ? "–" : new Intl.NumberFormat("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value),
  two: (value) => value == null ? "–" : new Intl.NumberFormat("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value),
  integer: (value) => value == null ? "–" : new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 0 }).format(value),
  date: (value) => value ? new Date(value).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }) : "–",
  signed: (value) => value == null ? "–" : `${value > 0 ? "+" : ""}${new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 1 }).format(value)}`
};

const metricLabels = {
  inwoners: "Inwoners",
  bevolkingsdichtheid: "Bevolkingsdichtheid",
  gemiddelde_woz: "Gemiddelde WOZ",
  gemiddeld_inkomen: "Gemiddeld inkomen",
  leeftijd_0_15_pct: "Aandeel 0–15 jaar",
  leeftijd_65_plus_pct: "Aandeel 65 jaar en ouder",
  eenpersoonshuishoudens_pct: "Eenpersoonshuishoudens",
  huishoudens_met_kinderen_pct: "Huishoudens met kinderen",
  huurwoningen_pct: "Huurwoningen",
  koopwoningen_pct: "Koopwoningen",
  eengezinswoningen_pct: "Eengezinswoningen",
  bijstand_pct_inwoners: "Inwoners met bijstand"
};

const domainLabels = {
  demografie: "leeftijd en huishoudens",
  woningstructuur: "woningtype en dichtheid",
  woningmarkt: "woningwaarde",
  sociaaleconomisch: "sociaaleconomisch profiel"
};

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function metricHistory(wijk, key) {
  return (wijk.history?.[key] || []).filter((row) => Number.isFinite(Number(row.waarde)));
}

function historyChange(wijk, key) {
  const rows = metricHistory(wijk, key);
  if (rows.length < 2) return null;
  const first = rows[0];
  const last = rows[rows.length - 1];
  return {
    start: Number(first.waarde),
    end: Number(last.waarde),
    startYear: first.jaar,
    endYear: last.jaar,
    absolute: Number(last.waarde) - Number(first.waarde),
    relative: Number(first.waarde) !== 0 ? 100 * (Number(last.waarde) - Number(first.waarde)) / Number(first.waarde) : null
  };
}

function metricUnit(key) {
  if (key === "gemiddelde_woz" || key === "gemiddeld_inkomen") return "euro";
  if (key === "inwoners" || key === "bevolkingsdichtheid") return "aantal";
  return "procent";
}

function metricValue(key, value) {
  if (value == null) return "–";
  if (key === "gemiddelde_woz" || key === "gemiddeld_inkomen") return `€ ${fmt.integer(value)}`;
  if (key === "inwoners" || key === "bevolkingsdichtheid") return fmt.integer(value);
  return `${fmt.one(value)}%`;
}

function metricDelta(key, value) {
  const absolute = Math.abs(value);
  if (key === "gemiddelde_woz" || key === "gemiddeld_inkomen") return `€ ${fmt.integer(absolute)}`;
  if (key === "inwoners" || key === "bevolkingsdichtheid") return fmt.integer(absolute);
  return `${fmt.one(absolute)} procentpunt`;
}

function getSelectedWijk() {
  return state.municipality?.wijken?.find((wijk) => wijk.wijk_code === $("district").value) || state.municipality?.wijken?.[0];
}

async function load() {
  state.index = await fetch("data/gemeenten.json", { cache: "no-store" }).then(checkResponse).then((response) => response.json());
  $("generatedAt").textContent = `Databuild ${fmt.date(state.index.generated_at)}`;

  const municipalitySelect = $("municipality");
  municipalitySelect.innerHTML = state.index.municipalities
    .map((item) => `<option value="${escapeHtml(item.slug)}">${escapeHtml(item.name)}</option>`)
    .join("");

  const params = new URLSearchParams(window.location.search);
  const requestedMunicipality = params.get("gemeente");
  const initialMunicipality = state.index.municipalities.some((item) => item.slug === requestedMunicipality)
    ? requestedMunicipality
    : state.index.default_slug;

  municipalitySelect.value = initialMunicipality;
  municipalitySelect.addEventListener("change", () => loadMunicipality(municipalitySelect.value));
  $("district").addEventListener("change", () => {
    updateUrl();
    render();
  });
  $("shareButton").addEventListener("click", shareCurrentWijk);

  await loadMunicipality(initialMunicipality, params.get("wijk"));
}

function checkResponse(response) {
  if (!response.ok) throw new Error(`Databestand niet beschikbaar (${response.status})`);
  return response;
}

async function loadMunicipality(slug, requestedWijk = null) {
  const districtSelect = $("district");
  districtSelect.disabled = true;
  state.municipality = await fetch(`data/${slug}.json`, { cache: "no-store" }).then(checkResponse).then((response) => response.json());
  districtSelect.innerHTML = state.municipality.wijken
    .map((wijk) => `<option value="${escapeHtml(wijk.wijk_code)}">${escapeHtml(wijk.wijk_naam)}</option>`)
    .join("");

  if (requestedWijk && state.municipality.wijken.some((wijk) => wijk.wijk_code === requestedWijk)) {
    districtSelect.value = requestedWijk;
  } else {
    const representative = state.municipality.wijken.find((wijk) => wijk.signal && (wijk.historical?.analogs || []).length > 0);
    if (representative) districtSelect.value = representative.wijk_code;
  }
  districtSelect.disabled = false;
  updateUrl();
  render();
}

function updateUrl() {
  const wijk = getSelectedWijk();
  if (!wijk) return;
  const url = new URL(window.location.href);
  url.searchParams.set("gemeente", $("municipality").value);
  url.searchParams.set("wijk", wijk.wijk_code);
  window.history.replaceState({}, "", url);
}

async function shareCurrentWijk() {
  const button = $("shareButton");
  const note = $("finderNote");
  try {
    await navigator.clipboard.writeText(window.location.href);
    button.classList.add("copied");
    button.innerHTML = '<span aria-hidden="true">✓</span> Link gekopieerd';
    note.textContent = "De directe link naar dit wijkbeeld staat op het klembord.";
    window.setTimeout(() => {
      button.classList.remove("copied");
      button.innerHTML = '<span aria-hidden="true">↗</span> Deel dit wijkbeeld';
    }, 2200);
  } catch {
    note.textContent = "Kopiëren lukte niet. De wijkcode staat al in de adresbalk.";
  }
}

function render() {
  const wijk = getSelectedWijk();
  if (!wijk) return;
  $("districtTitle").textContent = `${wijk.wijk_naam}, ${wijk.gemeente}`;
  $("freshness").innerHTML = [
    `Wijkprofiel ${wijk.latest_year}`,
    state.municipality.sources?.leefbaarheid?.latest_year ? `Leefbaarheid ${state.municipality.sources.leefbaarheid.latest_year}` : null
  ].filter(Boolean).map((label) => `<span>${escapeHtml(label)}</span>`).join("");

  renderCore(wijk);
  renderDirection(wijk);
  renderHistorical(wijk);
  renderMethod(wijk);
}

function percentileSignals(wijk) {
  const signal = wijk.signal || {};
  return [
    {
      key: "peer",
      score: Number(signal.peer_afwijking_percentiel),
      title: "Anders dan vergelijkbare wijken",
      text: "De recente ontwikkeling wijkt af van structureel vergelijkbare wijken."
    },
    {
      key: "movement",
      score: Number(signal.profielbeweging_percentiel),
      title: "Tempo van verandering",
      text: "Het totale wijkprofiel beweegt sterker dan bij veel referentiewijken."
    },
    {
      key: "history",
      score: Number(signal.historische_zeldzaamheid_percentiel),
      title: "Weinig historische voorbeelden",
      text: "Er zijn relatief weinig zeer vergelijkbare historische situaties."
    }
  ].filter((item) => Number.isFinite(item.score));
}

function buildCore(wijk) {
  const signals = percentileSignals(wijk).sort((a, b) => b.score - a.score);
  const strongest = signals[0];
  const selectedDrivers = selectMetricDrivers(wijk);

  if (!signals.length) {
    return {
      title: `Voor ${wijk.wijk_naam} is geen betrouwbare peer-vergelijking beschikbaar.`,
      message: "De beschikbare historie of vergelijkbaarheid is onvoldoende. WijkRichting toont daarom geen ontwikkelsignaal en vult ontbrekende uitkomsten niet in.",
      signals
    };
  }

  let title = `${wijk.wijk_naam} verandert zonder uitzonderlijk landelijk signaal.`;
  if (strongest?.score >= 90 && strongest.key === "peer") title = `${wijk.wijk_naam} ontwikkelt zich anders dan vergelijkbare wijken.`;
  if (strongest?.score >= 90 && strongest.key === "movement") title = `${wijk.wijk_naam} verandert sneller dan de meeste referentiewijken.`;
  if (strongest?.score >= 90 && strongest.key === "history") title = `Voor ${wijk.wijk_naam} is weinig vergelijkbaar historisch precedent.`;
  if (strongest?.score >= 75 && strongest?.score < 90) title = `${wijk.wijk_naam} laat een duidelijke, maar niet uitzonderlijke beweging zien.`;

  const sentences = [];
  const meaningfulDrivers = selectedDrivers.filter((driver) => {
    const change = historyChange(wijk, driver.indicator);
    if (!change) return false;
    const threshold = metricUnit(driver.indicator) === "procent" ? 0.1 : 1;
    return Math.abs(change.absolute) >= threshold;
  });
  meaningfulDrivers.slice(0, 2).forEach((driver) => {
    const change = historyChange(wijk, driver.indicator);
    if (!change) return;
    const direction = change.absolute > 0 ? "steeg" : change.absolute < 0 ? "daalde" : "bleef gelijk";
    const amount = change.absolute === 0 ? "" : ` met ${metricDelta(driver.indicator, change.absolute)}`;
    sentences.push(`${metricLabels[driver.indicator] || driver.label} ${direction} sinds ${change.startYear}${amount}.`);
  });

  const historicalOutcomes = Object.values(wijk.historical?.relative_outcomes || {})
    .filter((item) => Number.isFinite(item.mediaan_tov_landelijk) && Number.isFinite(item.p25_tov_landelijk) && Number.isFinite(item.p75_tov_landelijk))
    .sort((a, b) => Math.abs(b.mediaan_tov_landelijk) - Math.abs(a.mediaan_tov_landelijk));
  const consistentHistorical = historicalOutcomes.find((item) => item.p25_tov_landelijk > 0 || item.p75_tov_landelijk < 0);
  if (consistentHistorical) {
    const position = consistentHistorical.mediaan_tov_landelijk > 0 ? "boven" : "onder";
    sentences.push(`Bij historische wijk-tweelingen lag de verandering van ${consistentHistorical.label.toLowerCase()} daarna mediaan ${fmt.one(Math.abs(consistentHistorical.mediaan_tov_landelijk))} procentpunt ${position} de landelijke ontwikkeling.`);
  } else {
    sentences.push("Historische wijk-tweelingen laten uiteenlopende vervolgrichtingen zien; de spreiding is belangrijker dan één puntschatting.");
  }

  return { title, message: sentences.join(" "), signals };
}

function renderCore(wijk) {
  const core = buildCore(wijk);
  $("coreTitle").textContent = core.title;
  $("coreMessage").textContent = core.message;

  const notable = core.signals.filter((item) => item.score >= 75).slice(0, 3);
  const displayed = notable.length ? notable : core.signals.slice(0, 2);
  $("signalGrid").innerHTML = displayed.length ? displayed.map((item) => `
    <div class="signal-card ${item.score >= 90 ? "warn" : ""}">
      <div class="signal-value">${item.score >= 90 ? "Sterk" : item.score >= 75 ? "Duidelijk" : "Rustig"}</div>
      <div><strong>${escapeHtml(item.title)}</strong><span>Sterker dan bij ${fmt.integer(item.score)} van 100 referentiewijken</span></div>
    </div>`).join("") : '<div class="empty-state">Geen verantwoord peer-signaal beschikbaar.</div>';
}

function selectMetricDrivers(wijk) {
  const drivers = (wijk.direction?.drivers || [])
    .filter((driver) => metricHistory(wijk, driver.indicator).length >= 2);
  const selected = [];
  const usedDomains = new Set();

  drivers.forEach((driver) => {
    if (selected.length >= 3 || usedDomains.has(driver.domein)) return;
    selected.push(driver);
    usedDomains.add(driver.domein);
  });
  drivers.forEach((driver) => {
    if (selected.length < 3 && !selected.includes(driver)) selected.push(driver);
  });

  const fallbackKeys = ["gemiddelde_woz", "leeftijd_65_plus_pct", "huishoudens_met_kinderen_pct", "inwoners"];
  fallbackKeys.forEach((indicator) => {
    if (selected.length < 3 && metricHistory(wijk, indicator).length >= 2 && !selected.some((item) => item.indicator === indicator)) {
      selected.push({ indicator, label: metricLabels[indicator], domein: "Wijkprofiel" });
    }
  });
  return selected.slice(0, 3);
}

function developmentMeaning(key, change) {
  if (!change) return "Onvoldoende meetjaren.";
  if (Math.abs(change.absolute) < 0.05) return "De gemeten waarde bleef vrijwel gelijk.";
  const movement = change.absolute > 0 ? "nam toe" : "nam af";
  if (metricUnit(key) === "procent") return `Het aandeel ${movement} met ${metricDelta(key, change.absolute)}.`;
  return `De gemeten waarde ${movement} met ${metricDelta(key, change.absolute)}.`;
}

function renderActiveMetric(wijk, key) {
  const rows = metricHistory(wijk, key);
  const change = historyChange(wijk, key);
  $("trajectoryTitle").textContent = metricLabels[key] || "Wijkontwikkeling";
  $("trajectoryUnit").textContent = metricUnit(key) === "procent" ? "aandeel van de wijk" : "werkelijke waarden";
  $("trajectoryChart").innerHTML = rows.length >= 2 ? trajectorySvg(rows, key, wijk.wijk_naam) : '<div class="empty-state">Geen consistente tijdreeks beschikbaar.</div>';
  $("trajectoryNote").textContent = change
    ? `${change.startYear}–${change.endYear}: ${metricValue(key, change.start)} naar ${metricValue(key, change.end)}. Dit zijn gemeten waarden, geen voorspelling.`
    : "Onvoldoende vergelijkbare meetjaren.";
  $("metricTabs").querySelectorAll("button").forEach((button) => {
    const active = button.dataset.metric === key;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
}

function peerWhy(peer) {
  const domains = Object.entries(peer.domeinafstanden || {})
    .filter(([, value]) => Number.isFinite(Number(value)))
    .sort((a, b) => a[1] - b[1])
    .slice(0, 2)
    .map(([key]) => domainLabels[key] || key);
  return domains.length ? `Vooral overeenkomst in ${domains.join(" en ")}.` : "Vergelijkbaar op het totale wijkprofiel.";
}

function peerReading(wijk) {
  const score = Number(wijk.signal?.peer_afwijking_percentiel);
  if (!Number.isFinite(score)) return "Voor deze wijk is geen betrouwbare landelijke vergelijking beschikbaar.";
  if (score >= 90) return `De recente ontwikkeling wijkt sterker af van vergelijkbare wijken dan bij ${fmt.integer(score)} van 100 referentiewijken. Dat maakt het patroon opvallend, niet automatisch gunstig of ongunstig.`;
  if (score >= 75) return `De recente ontwikkeling wijkt sterker af dan bij ${fmt.integer(score)} van 100 referentiewijken. Het verschil is duidelijk, maar niet uitzonderlijk.`;
  return `De recente ontwikkeling valt binnen wat bij veel vergelijkbare wijken voorkomt: sterker afwijkend dan bij ${fmt.integer(score)} van 100 referentiewijken.`;
}

function renderDirection(wijk) {
  const drivers = selectMetricDrivers(wijk);
  const validKeys = drivers.map((driver) => driver.indicator);
  if (!validKeys.includes(state.selectedMetric)) state.selectedMetric = validKeys[0];
  $("directionIntro").textContent = drivers.length >= 3
    ? "Drie ontwikkelingen die samen laten zien wat er in de wijk verandert."
    : drivers.length === 2
      ? "Twee consistente ontwikkelingen; voor een derde reeks ontbreken voldoende meetjaren."
      : "Alleen ontwikkelingen met voldoende vergelijkbare meetjaren worden getoond.";

  $("metricTabs").innerHTML = drivers.map((driver, index) => `
    <button type="button" role="tab" data-metric="${escapeHtml(driver.indicator)}" aria-selected="${index === 0}">${escapeHtml(metricLabels[driver.indicator] || driver.label)}</button>`).join("");
  $("metricTabs").querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedMetric = button.dataset.metric;
      renderActiveMetric(wijk, state.selectedMetric);
    });
  });

  $("metricSummary").innerHTML = drivers.map((driver) => {
    const change = historyChange(wijk, driver.indicator);
    return `<article class="metric-summary-card">
      <span>${escapeHtml(metricLabels[driver.indicator] || driver.label)}</span>
      <strong>${change ? `${metricValue(driver.indicator, change.start)} → ${metricValue(driver.indicator, change.end)}` : "Onvoldoende data"}</strong>
      <p>${escapeHtml(developmentMeaning(driver.indicator, change))}</p>
    </article>`;
  }).join("") || '<div class="empty-state">Geen drie consistente tijdreeksen beschikbaar.</div>';

  if (state.selectedMetric) renderActiveMetric(wijk, state.selectedMetric);

  const peers = (wijk.peers || []).slice(0, 4);
  $("peerIntro").textContent = peers.length
    ? "Dit zijn de meest vergelijkbare huidige wijken. De toelichting noemt de onderdelen waarop de overeenkomst het sterkst is."
    : "Er zijn onvoldoende vergelijkbare wijken gevonden.";
  $("currentPeers").innerHTML = peers.map((peer) => `
    <li>
      <span class="peer-rank">${fmt.integer(peer.rank)}</span>
      <div><strong>${escapeHtml(peer.wijk_naam)}</strong><span>${escapeHtml(peer.gemeente)}</span><p>${escapeHtml(peerWhy(peer))}</p></div>
    </li>`).join("") || '<li class="empty-state">Geen betrouwbare vergelijkingswijken beschikbaar.</li>';
  $("peerReading").textContent = peerReading(wijk);
}

function trajectorySvg(rows, key, wijkName) {
  const width = 640;
  const height = 245;
  const pad = { left: 42, right: 28, top: 28, bottom: 40 };
  const values = rows.map((row) => Number(row.waarde));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const extra = (max - min) * .18 || Math.abs(max) * .08 || 1;
  const low = min - extra;
  const high = max + extra;
  const x = (index) => pad.left + index * (width - pad.left - pad.right) / Math.max(1, rows.length - 1);
  const y = (value) => pad.top + (high - value) * (height - pad.top - pad.bottom) / (high - low);
  const points = rows.map((row, index) => `${x(index)},${y(Number(row.waarde))}`).join(" ");
  const area = `${pad.left},${height - pad.bottom} ${points} ${x(rows.length - 1)},${height - pad.bottom}`;
  const grid = [0, .5, 1].map((ratio) => {
    const yy = pad.top + ratio * (height - pad.top - pad.bottom);
    return `<line x1="${pad.left}" y1="${yy}" x2="${width - pad.right}" y2="${yy}" class="grid-line" />`;
  }).join("");
  const marks = rows.map((row, index) => {
    const xx = x(index);
    const yy = y(Number(row.waarde));
    return `<text x="${xx}" y="${height - 14}" text-anchor="middle" class="svg-label">${row.jaar}</text>
      <text x="${xx}" y="${yy - 13}" text-anchor="middle" class="svg-value">${escapeHtml(metricValue(key, row.waarde))}</text>
      <circle cx="${xx}" cy="${yy}" r="6" class="trend-dot"><title>${row.jaar}: ${escapeHtml(metricValue(key, row.waarde))}</title></circle>`;
  }).join("");

  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="trajectory-svg-title trajectory-svg-desc">
    <title id="trajectory-svg-title">Ontwikkeling van ${escapeHtml(metricLabels[key] || key)} in ${escapeHtml(wijkName)}</title>
    <desc id="trajectory-svg-desc">Werkelijke meetwaarden van ${rows[0].jaar} tot ${rows[rows.length - 1].jaar}.</desc>
    ${grid}
    <line x1="${pad.left}" y1="${height - pad.bottom}" x2="${width - pad.right}" y2="${height - pad.bottom}" class="axis-line" />
    <polygon points="${area}" class="trend-area" />
    <polyline points="${points}" class="trend-line" />
    ${marks}
  </svg>`;
}

function renderHistorical(wijk) {
  const historical = wijk.historical || {};
  const outcomes = Object.values(historical.relative_outcomes || {})
    .filter((item) => Number.isFinite(item.mediaan_tov_landelijk) && Number.isFinite(item.p25_tov_landelijk) && Number.isFinite(item.p75_tov_landelijk))
    .sort((a, b) => Math.abs(b.mediaan_tov_landelijk) - Math.abs(a.mediaan_tov_landelijk))
    .slice(0, 3);
  const n = outcomes[0]?.n || historical.method?.k;

  $("historicalSample").textContent = n ? `${fmt.integer(n)} analogieën · 2 jaar vooruit` : "Onvoldoende historie";
  $("historicalIntro").textContent = n
    ? `De balk toont de middelste helft van de werkelijke uitkomsten. De stip is de mediaan ten opzichte van de landelijke ontwikkeling; dit is een empirische richting, geen voorspelling.`
    : "Voor deze wijk is onvoldoende vergelijkbare historie beschikbaar.";
  $("mirrorChart").innerHTML = outcomes.length ? mirrorSvg(outcomes, wijk.wijk_naam) : '<div class="empty-state">Onvoldoende vergelijkbare historische trajecten.</div>';

  $("historicalTwins").innerHTML = (historical.analogs || []).slice(0, 3).map((item) => `
    <li>
      <div><strong>${escapeHtml(item.wijk_naam)}</strong><span>${escapeHtml(item.gemeente)}</span></div>
      <span class="twin-period">${item.anchor_year} → ${item.future_year}</span>
    </li>`).join("") || '<li><div><strong>Geen bruikbare tweelingen</strong><span>Onvoldoende vergelijkbare historie</span></div></li>';

  const validation = historical.validation || state.municipality.method?.historical_validation?.analog_calibration || {};
  const holdout = validation.selected_analogy_holdout || {};
  $("validationStrip").innerHTML = outcomes.length ? `
    <strong>Wat zegt de historische test?</strong>
    <p>Bij ${fmt.integer(holdout.beter_dan_landelijke_trend_pct)} van 100 geteste wijken gaf deze methode een nauwkeuriger richting dan alleen de landelijke ontwikkeling. Dat is een bescheiden aanwijzing: gebruik de spiegel als vergelijkingskader, niet als voorspelling.</p>`
    : '<strong>Geen historische spiegel</strong><p>De methode is landelijk getest, maar voor deze wijk ontbreken voldoende vergelijkbare historische trajecten.</p>';

  renderContext(wijk);
}

function renderContext(wijk) {
  const leefbaarheid = wijk.leefbaarheid || {};
  const leefHistory = leefbaarheid.history || [];
  const leefFirst = leefHistory[0];
  const leefLast = leefbaarheid.latest || leefHistory[leefHistory.length - 1];
  const leefDelta = leefFirst && leefLast ? Number(leefLast.waarde) - Number(leefFirst.waarde) : null;
  let leefText = "Geen consistente leefbaarheidsreeks beschikbaar.";
  if (Number.isFinite(leefDelta)) {
    const movement = Math.abs(leefDelta) < 0.05 ? "vrijwel stabiel" : leefDelta > 0 ? "toegenomen" : "afgenomen";
    leefText = Math.abs(leefDelta) < 0.05
      ? `Sinds ${leefFirst.jaar} is de score vrijwel stabiel.`
      : `Sinds ${leefFirst.jaar} is de score ${movement} (${leefDelta > 0 ? "+" : ""}${fmt.two(leefDelta)} punt).`;
  }

  const crime = wijk.criminaliteit || {};
  const crimeAvailable = crime.status === "ok" && Number.isFinite(Number(crime.laatste_12m_aantal));
  const smallPopulation = Boolean(crime.kleine_populatie);
  let crimeChange = "Geen vergelijking met de voorgaande twaalf maanden beschikbaar.";
  if (crimeAvailable && Number.isFinite(Number(crime.verandering_pct))) {
    const value = Number(crime.verandering_pct);
    crimeChange = Math.abs(value) < 0.1
      ? "Evenveel registraties als in de voorgaande twaalf maanden."
      : `${fmt.one(Math.abs(value))}% ${value > 0 ? "meer" : "minder"} registraties dan in de voorgaande twaalf maanden.`;
  }
  if (crimeAvailable && smallPopulation) {
    crimeChange += " Deze wijk heeft weinig inwoners; een verhouding per 1.000 inwoners zou daardoor misleidend zijn.";
  }

  $("contextGrid").innerHTML = `
    <article class="context-card">
      <span>Leefbaarheid · ${escapeHtml(leefLast?.jaar || "geen jaar")}</span>
      <strong>${leefLast ? `${fmt.two(leefLast.waarde)} · ${escapeHtml(leefLast.klasse)}` : "Niet beschikbaar"}</strong>
      <p>${escapeHtml(leefText)}</p>
    </article>
    <article class="context-card">
      <span>Politieregistraties · ${escapeHtml(crime.laatste_periode || "geen periode")}</span>
      <strong>${crimeAvailable ? `${fmt.integer(crime.laatste_12m_aantal)} in 12 maanden${smallPopulation ? "" : ` · ${fmt.one(crime.laatste_12m_per_1000)} per 1.000 inwoners`}` : "Niet beschikbaar"}</strong>
      <p>${escapeHtml(crimeChange)} Registraties zijn context, geen volledig beeld van veiligheid.</p>
    </article>`;
}

function mirrorSvg(outcomes, wijkName) {
  const width = 700;
  const height = 70 + outcomes.length * 58;
  const pad = { left: 165, right: 62, top: 36, bottom: 35 };
  const rawMin = Math.min(0, ...outcomes.map((item) => item.p25_tov_landelijk));
  const rawMax = Math.max(0, ...outcomes.map((item) => item.p75_tov_landelijk));
  const span = rawMax - rawMin || 1;
  const low = rawMin - span * .12;
  const high = rawMax + span * .12;
  const x = (value) => pad.left + (value - low) * (width - pad.left - pad.right) / (high - low);
  const zeroX = x(0);
  const axisY = height - pad.bottom;
  const ticks = [low, 0, high];

  const rows = outcomes.map((item, index) => {
    const y = pad.top + index * 58 + 18;
    const median = item.mediaan_tov_landelijk;
    const description = `${item.label}: mediaan ${fmt.signed(median)} procentpunt; middelste 50 procent van ${fmt.signed(item.p25_tov_landelijk)} tot ${fmt.signed(item.p75_tov_landelijk)}.`;
    return `<text x="${pad.left - 14}" y="${y + 4}" text-anchor="end" class="mirror-row-label">${escapeHtml(item.label)}</text>
      <line x1="${x(item.p25_tov_landelijk)}" y1="${y}" x2="${x(item.p75_tov_landelijk)}" y2="${y}" class="mirror-range" />
      <circle cx="${x(median)}" cy="${y}" r="7" class="mirror-median" tabindex="0"><title>${escapeHtml(description)}</title></circle>
      <text x="${width - 8}" y="${y + 4}" text-anchor="end" class="svg-value">${fmt.signed(median)} pp</text>`;
  }).join("");
  const tickLabels = ticks.map((tick) => `<text x="${x(tick)}" y="${axisY + 21}" text-anchor="middle" class="mirror-axis-label">${fmt.signed(tick)} pp</text>`).join("");

  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="mirror-svg-title mirror-svg-desc">
    <title id="mirror-svg-title">Uitkomsten van historische wijk-tweelingen voor ${escapeHtml(wijkName)}</title>
    <desc id="mirror-svg-desc">Mediaan en middelste vijftig procent van de ontwikkeling in de twee jaar na de historische vergelijking, relatief aan de landelijke ontwikkeling.</desc>
    <line x1="${zeroX}" y1="${pad.top - 12}" x2="${zeroX}" y2="${axisY}" class="mirror-zero" />
    ${rows}
    <line x1="${pad.left}" y1="${axisY}" x2="${width - pad.right}" y2="${axisY}" class="axis-line" />
    ${tickLabels}
  </svg>`;
}

function renderMethod(wijk) {
  const method = wijk.historical?.method || {};
  const validationPeriod = state.municipality.method?.historical_validation?.direction_backtest?.periods?.[0] || {};
  const sources = state.municipality.sources || {};
  const continuity = state.municipality.method?.historical_validation?.continuity_rule;
  const featureCount = method.features?.length || validationPeriod.n_features;
  const domainCount = method.domains?.length || validationPeriod.n_domeinen;
  const holdout = wijk.historical?.validation?.selected_analogy_holdout
    || state.municipality.method?.historical_validation?.analog_calibration?.selected_analogy_holdout
    || {};
  const firstStructuralYear = Object.values(wijk.history || {})
    .flat()
    .map((row) => Number(row.jaar))
    .filter(Number.isFinite)
    .sort((a, b) => a - b)[0];

  $("methodGrid").innerHTML = `
    <div class="method-card"><span>Gebruikte jaren</span><strong>${escapeHtml(firstStructuralYear || "–")}–${escapeHtml(wijk.latest_year)}</strong><p>De bronjaren worden per indicator getoond; recentere veiligheidsdata staan apart als context.</p></div>
    <div class="method-card"><span>Zoeken naar gelijkenis</span><strong>${fmt.integer(featureCount)} kenmerken · ${fmt.integer(domainCount)} thema’s</strong><p>Demografie, woningen, woningmarkt en sociaaleconomie wegen evenwichtig mee.</p></div>
    <div class="method-card"><span>Historisch getest</span><strong>${fmt.integer(holdout.n)} wijken · latere periode</strong><p>De instellingen zijn gekozen met eerdere jaren en daarna gecontroleerd met nieuwere jaren.</p></div>
    <div class="method-card"><span>Openbare bronnen</span><strong>CBS · Leefbaarometer · Politie/CBS</strong><p>Alleen gemeten en herleidbare brondata; ontbrekende uitkomsten worden niet ingevuld.</p></div>`;

  $("methodDetail").innerHTML = `
    <p><strong>Hoe worden tweelingen gekozen?</strong> Eerst blijft de ${fmt.one((method.profile_gate_pct || 0) * 100)}% meest vergelijkbare historie over. Binnen die groep worden de ${fmt.integer(method.k)} beste matches samengevat. De huidige gelijkenis en het eerdere ontwikkelpad tellen ieder voor de helft mee.</p>
    <p><strong>Welke beperkingen gelden?</strong> ${escapeHtml(continuity || "Alleen door de tijd vergelijkbare wijkcodes worden gebruikt.")} Een overeenkomst uit het verleden bewijst geen oorzaak en voorspelt niet wat in deze wijk zal gebeuren. Bronnen: ${escapeHtml(sources.structuur?.name || "CBS Kerncijfers Wijken en Buurten")}, ${escapeHtml(sources.leefbaarheid?.name || "Leefbaarometer 3.0")} en ${escapeHtml(sources.criminaliteit?.name || "Politie/CBS")}.</p>`;
}

load().catch((error) => {
  console.error(error);
  $("resultaat").innerHTML = `<div class="shell"><div class="panel"><p class="overline">Dataprobleem</p><h2>Het wijkbeeld kon niet worden geladen.</h2><p>${escapeHtml(error.message)}</p></div></div>`;
});
