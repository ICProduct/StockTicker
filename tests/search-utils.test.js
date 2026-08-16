const test = require("node:test");
const assert = require("node:assert/strict");
const searchUtils = require("../search-utils.js");

test("puts TW before TWO and other markets while preserving group order", () => {
  const results = [
    { symbol: "AAPL" },
    { symbol: "00679B.TWO" },
    { symbol: "0050.TW" },
    { symbol: "MSFT" },
    { symbol: "2330.TW" }
  ];
  assert.deepEqual(
    searchUtils.prioritizeTaiwanSymbols(results).map((quote) => quote.symbol),
    ["0050.TW", "2330.TW", "00679B.TWO", "AAPL", "MSFT"]
  );
});

test("replaces Yahoo ETF names with official Chinese names", () => {
  const results = [{ symbol: "0050.TW", shortname: "Yuanta Taiwan 50 ETF", quoteType: "ETF" }];
  const listings = [{
    symbol: "0050.TW",
    shortname: "元大台灣50",
    longname: "元大台灣卓越50證券投資信託基金",
    exchDisp: "台灣證券交易所 · ETF",
    quoteType: "ETF"
  }];
  const [localized] = searchUtils.applyTaiwanNames(results, listings);
  assert.equal(localized.shortname, "元大台灣50");
  assert.equal(localized.longname, "元大台灣卓越50證券投資信託基金");
});
