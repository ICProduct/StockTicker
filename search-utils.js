(function exposeSearchUtils(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.StockTickerSearch = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createSearchUtils() {
  "use strict";

  function marketPriority(symbol) {
    const normalized = String(symbol || "").toUpperCase();
    if (normalized.endsWith(".TW")) return 0;
    if (normalized.endsWith(".TWO")) return 1;
    return 2;
  }

  function prioritizeTaiwanSymbols(results) {
    return results
      .map((quote, index) => ({ quote, index }))
      .sort((a, b) => marketPriority(a.quote.symbol) - marketPriority(b.quote.symbol) || a.index - b.index)
      .map(({ quote }) => quote);
  }

  function applyTaiwanNames(results, listings) {
    const listingBySymbol = new Map(
      listings.map((quote) => [String(quote.symbol || "").toUpperCase(), quote])
    );

    return results.map((quote) => {
      const listing = listingBySymbol.get(String(quote.symbol || "").toUpperCase());
      if (!listing) return quote;
      return {
        ...quote,
        shortname: listing.shortname || quote.shortname,
        longname: listing.longname || quote.longname,
        exchDisp: listing.exchDisp || quote.exchDisp,
        quoteType: listing.quoteType || quote.quoteType
      };
    });
  }

  return { marketPriority, prioritizeTaiwanSymbols, applyTaiwanNames };
});
