(function exposePortableStore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.StockTickerPortable = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createPortableStore() {
  "use strict";

  const FORMAT = "stockticker-portable-backup";
  const NAMESPACE = "stockticker.settings";
  const SCHEMA_VERSION = 1;
  const MAX_QUOTES = 500;
  const MAX_PAGES = 50;
  // chrome.storage.sync counts the JSON-encoded UTF-8 value, not JavaScript
  // characters. Keeping each encoded chunk below 6 KB leaves room for its key
  // and stays safely below the browser's 8 KB per-item limit.
  const SYNC_CHUNK_SIZE = 6_000;

  function portableError(message, code) {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function trimToCodePoints(value, limit) {
    return Array.from(String(value || "").trim()).slice(0, limit).join("");
  }

  function normalizePortableData(input) {
    if (!isPlainObject(input)) throw portableError("Backup data must be an object.", "INVALID_DATA");

    if (!Array.isArray(input.quotePages) || !input.quotePages.length || input.quotePages.length > MAX_PAGES) {
      throw portableError("Backup pages are missing or oversized.", "INVALID_PAGES");
    }

    const quotePages = input.quotePages.map((pageId) => {
      if (typeof pageId !== "string" || !pageId.trim() || pageId.length > 64) {
        throw portableError("Backup contains an invalid page identifier.", "INVALID_PAGES");
      }
      return pageId.trim();
    });
    if (new Set(quotePages).size !== quotePages.length) {
      throw portableError("Backup contains duplicate pages.", "INVALID_PAGES");
    }

    if (!Array.isArray(input.trackedQuotes) || input.trackedQuotes.length > MAX_QUOTES) {
      throw portableError("Backup stock list is invalid or oversized.", "INVALID_QUOTES");
    }

    const seenSymbols = new Set();
    const trackedQuotes = input.trackedQuotes.map((quote) => {
      if (!isPlainObject(quote)) throw portableError("Backup contains an invalid stock.", "INVALID_QUOTES");
      const symbol = String(quote.symbol || "").trim().toUpperCase();
      if (!/^[A-Z0-9^.=+\-:/]{1,30}$/.test(symbol) || seenSymbols.has(symbol)) {
        throw portableError("Backup contains an invalid or duplicate stock symbol.", "INVALID_QUOTES");
      }
      if (!quotePages.includes(quote.pageId)) {
        throw portableError("A stock points to a page that does not exist.", "INVALID_QUOTES");
      }
      const name = String(quote.name || "").trim();
      if (name.length > 200) throw portableError("A stock name is too long.", "INVALID_QUOTES");
      seenSymbols.add(symbol);
      return { symbol, name, pageId: quote.pageId };
    });

    const currentPageId = String(input.currentPageId || "");
    if (!quotePages.includes(currentPageId)) {
      throw portableError("Current page does not exist.", "INVALID_CURRENT_PAGE");
    }

    if (!isPlainObject(input.pageNames)) throw portableError("Page names are invalid.", "INVALID_PAGE_NAMES");
    const pageNames = {};
    Object.entries(input.pageNames).forEach(([pageId, rawName]) => {
      if (!quotePages.includes(pageId) || typeof rawName !== "string") {
        throw portableError("Page names contain an unknown page.", "INVALID_PAGE_NAMES");
      }
      const name = trimToCodePoints(rawName, 3);
      if (Array.from(rawName.trim()).length > 3) {
        throw portableError("Page names may contain at most three characters.", "INVALID_PAGE_NAMES");
      }
      if (name) pageNames[pageId] = name;
    });

    const preferredSite = input.preferredSite === "wantgoo" ? "wantgoo" : input.preferredSite === "yahoo" ? "yahoo" : null;
    if (!preferredSite) throw portableError("Preferred stock site is invalid.", "INVALID_PREFERRED_SITE");

    return { trackedQuotes, quotePages, currentPageId, pageNames, preferredSite };
  }

  function createBackup(data, exportedAt = Date.now()) {
    return {
      format: FORMAT,
      schemaVersion: SCHEMA_VERSION,
      namespace: NAMESPACE,
      exportedAt: new Date(exportedAt).toISOString(),
      data: normalizePortableData(data)
    };
  }

  function parseBackup(payload) {
    if (!isPlainObject(payload) || payload.format !== FORMAT) {
      throw portableError("This is not a StockTicker backup file.", "INVALID_FORMAT");
    }
    if (payload.namespace !== NAMESPACE) {
      throw portableError("Backup namespace does not match StockTicker.", "NAMESPACE_MISMATCH");
    }
    if (payload.schemaVersion !== SCHEMA_VERSION) {
      throw portableError("Backup version is not supported.", "UNSUPPORTED_VERSION");
    }
    if (typeof payload.exportedAt !== "string" || !Number.isFinite(Date.parse(payload.exportedAt))) {
      throw portableError("Backup export time is invalid.", "INVALID_METADATA");
    }
    return normalizePortableData(payload.data);
  }

  function hashString(value) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function encodedStorageBytes(value) {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  }

  function splitForSync(value, maxEncodedBytes = SYNC_CHUNK_SIZE) {
    if (typeof value !== "string" || !Number.isInteger(maxEncodedBytes) || maxEncodedBytes < 4) {
      throw portableError("Sync payload cannot be split.", "INVALID_SYNC_PAYLOAD");
    }
    const chunks = [];
    let chunk = "";
    let encodedBytes = 2;
    for (const character of value) {
      const characterBytes = encodedStorageBytes(character) - 2;
      if (chunk && encodedBytes + characterBytes > maxEncodedBytes) {
        chunks.push(chunk);
        chunk = character;
        encodedBytes = 2 + characterBytes;
      } else {
        chunk += character;
        encodedBytes += characterBytes;
      }
      if (encodedBytes > maxEncodedBytes) {
        throw portableError("A sync character exceeds the chunk limit.", "INVALID_SYNC_PAYLOAD");
      }
    }
    if (chunk) chunks.push(chunk);
    return chunks.length ? chunks : [""];
  }

  return {
    FORMAT,
    NAMESPACE,
    SCHEMA_VERSION,
    MAX_QUOTES,
    MAX_PAGES,
    SYNC_CHUNK_SIZE,
    createBackup,
    parseBackup,
    normalizePortableData,
    hashString,
    encodedStorageBytes,
    splitForSync
  };
});
