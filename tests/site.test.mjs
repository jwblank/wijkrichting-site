import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const readText = (path) => readFile(new URL(path, root), "utf8");
const readJson = async (path) => JSON.parse(await readText(path));

test("de gemeente-index verwijst naar bestaande, unieke databestanden", async () => {
  const index = await readJson("data/gemeenten.json");
  assert.ok(index.municipalities.length > 300, "landelijke dekking ontbreekt");
  assert.equal(new Set(index.municipalities.map((item) => item.slug)).size, index.municipalities.length);
  assert.ok(index.municipalities.some((item) => item.slug === index.default_slug));

  for (const municipality of index.municipalities) {
    const data = await readJson(municipality.data_file);
    assert.equal(data.municipality.cbs_code, municipality.cbs_code);
    assert.equal(data.wijken.length, municipality.wijk_count);
    assert.ok(data.wijken.length > 0);
  }
});

test("ieder wijkbeeld bevat de vereiste analytische bouwstenen", async () => {
  const index = await readJson("data/gemeenten.json");
  let wijkCount = 0;

  for (const municipality of index.municipalities) {
    const data = await readJson(municipality.data_file);
    assert.ok(data.method?.historical_validation?.analog_calibration);
    assert.ok(data.sources?.structuur?.latest_year);

    for (const wijk of data.wijken) {
      wijkCount += 1;
      assert.match(wijk.wijk_code, /^WK\d+$/);
      assert.ok(Object.keys(wijk.history || {}).length > 0);
      if (wijk.signal) {
        assert.ok(Number.isFinite(wijk.signal.peer_afwijking_percentiel));
        assert.ok(Number.isFinite(wijk.signal.profielbeweging_percentiel));
        assert.ok(Number.isFinite(wijk.signal.historische_zeldzaamheid_percentiel));
      }
      if ((wijk.historical?.analogs || []).length > 0) {
        assert.equal(wijk.historical.method?.k, 30);
        assert.equal(wijk.historical.validation?.holdout_period, "2022→2024");
        assert.ok(Object.keys(wijk.historical.relative_outcomes || {}).length >= 4);
      }
    }
  }

  assert.ok(wijkCount > 2000, "onvoldoende wijken voor landelijke referentie");
});

test("de pagina houdt de drie analytische onderdelen centraal", async () => {
  const html = await readText("index.html");
  const numberedSections = html.match(/class="section-number"/g) || [];
  assert.equal(numberedSections.length, 3);
  assert.match(html, /Het kernbeeld/);
  assert.match(html, /De ontwikkelrichting/);
  assert.match(html, /De historische spiegel/);
  assert.doesNotMatch(html, /Gemeenteoverzicht|Aanvullende context|lange tabel/i);
});

test("de zwakke trendbaseline wordt niet als voorspelling gepresenteerd", async () => {
  const data = await readJson("data/0489-barendrecht.json");
  const result = data.method.historical_validation.direction_backtest.overall;
  assert.ok(result.beter_dan_landelijke_trend_pct < 50);

  const app = await readText("assets/app.js");
  assert.match(app, /presteert niet beter dan deze baseline/);
  assert.match(app, /Onvoldoende vergelijkbare wijken voor een betrouwbare percentielpositie/);
  assert.match(app, /vult ontbrekende uitkomsten niet in/);
  assert.doesNotMatch(app, /AI-voorspelling|zekere voorspelling/i);
});
