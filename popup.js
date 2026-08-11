const UPDATE_INTERVAL_MS = 5_000;
const DEFAULT_SYMBOL = "2330.TW";
const LISTINGS_CACHE_MS = 24 * 60 * 60 * 1_000;
const SYNC_META_KEY = "stockticker.sync.meta";
const SYNC_CHUNK_PREFIX = "stockticker.sync.chunk";
const MAX_IMPORT_BYTES = 1024 * 1024;
const MAX_SYNC_SNAPSHOT_BYTES = 45_000;
const portableStore = globalThis.StockTickerPortable;

const elements = {
  form: document.querySelector("#symbolForm"),
  symbolInput: document.querySelector("#symbol"),
  searchResults: document.querySelector("#searchResults"),
  pageTabs: document.querySelector("#pageTabs"),
  addPage: document.querySelector("#addPage"),
  quoteList: document.querySelector("#quoteList"),
  quoteTemplate: document.querySelector("#quoteTemplate"),
  settingsToggle: document.querySelector("#settingsToggle"),
  settingsPanel: document.querySelector("#settingsPanel"),
  stockSite: document.querySelector("#stockSite"),
  pageName: document.querySelector("#pageName"),
  syncEnabled: document.querySelector("#syncEnabled"),
  syncStatus: document.querySelector("#syncStatus"),
  syncNow: document.querySelector("#syncNow"),
  exportData: document.querySelector("#exportData"),
  importData: document.querySelector("#importData"),
  importFile: document.querySelector("#importFile"),
  updatedAt: document.querySelector("#updatedAt"),
  status: document.querySelector("#status"),
  statusText: document.querySelector("#statusText"),
  error: document.querySelector("#error")
};

let updateTimer = null;
let searchTimer = null;
let searchRequest = null;
let matches = [];
let activeMatchIndex = -1;
let taiwanListings = null;
let trackedQuotes = [];
let quotePages = ["page-1"];
let currentPageId = "page-1";
let pageNames = {};
let draggedSymbol = "";
let dragBlocked = false;
let suppressCardClick = false;
let preferredSite = "yahoo";
let syncEnabled = false;
let syncJoined = false;
let portableUpdatedAt = 0;
let portableDeviceId = "";
let applyingRemoteState = false;
let syncWriteChain = Promise.resolve();
let syncWriteTimer = null;
let pendingSyncWrite = null;
const activeRequests = new Map();
const quoteCards = new Map();

function normalizeSymbol(value) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

function formatNumber(value, currency = "") {
  if (!Number.isFinite(value)) return "—";

  const decimals = Math.abs(value) >= 1000 || currency === "JPY" ? 0 : 2;
  return new Intl.NumberFormat("zh-TW", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
}

function formatBadgePrice(value) {
  if (!Number.isFinite(value)) return "";
  if (value >= 999_500) {
    const millions = value / 1_000_000;
    return `${millions < 10 ? millions.toFixed(1) : Math.round(millions)}M`;
  }
  if (value >= 9_950) return `${Math.round(value / 1_000)}K`;
  if (value >= 100) return String(Math.round(value));
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

async function clearIconBadge() {
  await Promise.all([
    chrome.action.setBadgeText({ text: "" }),
    chrome.action.setTitle({ title: "股價追蹤器" })
  ]);
}

async function updateIconBadge(quote, price, direction, currency, companyName) {
  if (getCurrentPageQuotes()[0]?.symbol !== quote.symbol) return;

  const colors = {
    positive: "#d93f55",
    negative: "#15966f",
    neutral: "#65738e"
  };
  const displaySymbol = quote.symbol.replace(/\.(TW|TWO)$/i, "");
  const fullPrice = formatNumber(price, currency);

  const badgeUpdates = [
    chrome.action.setBadgeText({ text: formatBadgePrice(price) }),
    chrome.action.setBadgeBackgroundColor({ color: colors[direction] }),
    chrome.action.setTitle({
      title: `${displaySymbol}${companyName ? ` ${companyName}` : ""} · ${currency || ""} ${fullPrice}`.trim()
    })
  ];

  if (chrome.action.setBadgeTextColor) {
    badgeUpdates.push(chrome.action.setBadgeTextColor({ color: "#FFFFFF" }));
  }

  await Promise.all(badgeUpdates);
}

function setStatus(state, text) {
  elements.status.dataset.state = state;
  elements.statusText.textContent = text;
}

function setCardLoading(card, isLoading) {
  const refreshButton = card.querySelector(".refresh");
  card.setAttribute("aria-busy", String(isLoading));
  refreshButton.classList.toggle("spinning", isLoading);
  refreshButton.disabled = isLoading;
}

function abortAllQuoteRequests() {
  activeRequests.forEach((request) => request.abort());
  activeRequests.clear();
}

function showError(message) {
  elements.error.textContent = message;
  elements.error.hidden = false;
  setStatus("error", "更新失敗");
}

function clearError() {
  elements.error.hidden = true;
  elements.error.textContent = "";
}

function closeSearchResults() {
  elements.searchResults.hidden = true;
  elements.symbolInput.setAttribute("aria-expanded", "false");
  elements.symbolInput.removeAttribute("aria-activedescendant");
  activeMatchIndex = -1;
}

function setActiveMatch(index) {
  if (!matches.length) return;

  activeMatchIndex = (index + matches.length) % matches.length;
  const options = elements.searchResults.querySelectorAll(".search-option");
  options.forEach((option, optionIndex) => {
    option.setAttribute("aria-selected", String(optionIndex === activeMatchIndex));
  });

  const activeOption = options[activeMatchIndex];
  elements.symbolInput.setAttribute("aria-activedescendant", activeOption.id);
  activeOption.scrollIntoView({ block: "nearest" });
}

function showSearchMessage(message) {
  matches = [];
  activeMatchIndex = -1;
  elements.searchResults.replaceChildren();
  const text = document.createElement("p");
  text.className = "search-message";
  text.textContent = message;
  elements.searchResults.append(text);
  elements.searchResults.hidden = false;
  elements.symbolInput.setAttribute("aria-expanded", "true");
}

function renderSearchResults(results) {
  matches = results;
  activeMatchIndex = -1;
  elements.searchResults.replaceChildren();

  if (!results.length) {
    showSearchMessage("找不到符合的股票，仍可直接輸入完整代號追蹤。");
    return;
  }

  results.forEach((quote, index) => {
    const option = document.createElement("button");
    const name = quote.shortname || quote.longname || quote.symbol;
    option.type = "button";
    option.id = `search-option-${index}`;
    option.className = "search-option";
    option.dataset.index = String(index);
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", "false");

    const nameElement = document.createElement("span");
    nameElement.textContent = name;
    const symbolElement = document.createElement("span");
    symbolElement.className = "search-symbol";
    symbolElement.textContent = quote.symbol;
    const exchangeElement = document.createElement("span");
    exchangeElement.className = "search-exchange";
    exchangeElement.textContent = quote.exchDisp || quote.exchange || quote.typeDisp || "股票";
    option.append(nameElement, symbolElement, exchangeElement);
    elements.searchResults.append(option);
  });

  elements.searchResults.hidden = false;
  elements.symbolInput.setAttribute("aria-expanded", "true");
}

function compactListing(symbol, shortname, longname, exchange) {
  return {
    symbol,
    shortname: String(shortname || "").trim(),
    longname: String(longname || "").trim(),
    exchDisp: exchange,
    quoteType: "EQUITY"
  };
}

async function loadTaiwanListings() {
  if (taiwanListings) return taiwanListings;

  const cached = await chrome.storage.local.get(["taiwanListings", "taiwanListingsUpdatedAt"]);
  const cacheIsFresh =
    Array.isArray(cached.taiwanListings) &&
    Date.now() - Number(cached.taiwanListingsUpdatedAt) < LISTINGS_CACHE_MS;

  if (cacheIsFresh) {
    taiwanListings = cached.taiwanListings;
    return taiwanListings;
  }

  const sources = await Promise.allSettled([
    fetch("https://openapi.twse.com.tw/v1/opendata/t187ap03_L", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`TWSE ${response.status}`);
        return response.json();
      })
      .then((rows) => rows.map((row) => compactListing(
        `${row["公司代號"]}.TW`,
        row["公司簡稱"],
        row["公司名稱"],
        "台灣證券交易所"
      ))),
    fetch("https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_O", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`TPEx ${response.status}`);
        return response.json();
      })
      .then((rows) => rows.map((row) => compactListing(
        `${row.SecuritiesCompanyCode}.TWO`,
        row.CompanyAbbreviation,
        row.CompanyName,
        "證券櫃檯買賣中心"
      )))
  ]);

  taiwanListings = sources
    .filter((source) => source.status === "fulfilled")
    .flatMap((source) => source.value)
    .filter((quote) => quote.symbol && quote.shortname);

  if (!taiwanListings.length) {
    const errors = sources
      .filter((source) => source.status === "rejected")
      .map((source) => source.reason?.message)
      .filter(Boolean)
      .join("、");
    throw new Error(errors || "無法取得台灣公司清單");
  }

  await chrome.storage.local.set({
    taiwanListings,
    taiwanListingsUpdatedAt: Date.now()
  });
  return taiwanListings;
}

async function searchTaiwanCompanies(query) {
  const listings = await loadTaiwanListings();
  const term = query.trim().replace(/\s+/g, "").toLocaleLowerCase("zh-Hant");

  return listings
    .map((quote) => {
      const shortname = quote.shortname.replace(/\s+/g, "").toLocaleLowerCase("zh-Hant");
      const longname = quote.longname.replace(/\s+/g, "").toLocaleLowerCase("zh-Hant");
      const code = quote.symbol.split(".")[0].toLocaleLowerCase();
      let score = 0;
      if (shortname === term || code === term) score = 4;
      else if (shortname.startsWith(term)) score = 3;
      else if (shortname.includes(term)) score = 2;
      else if (longname.includes(term)) score = 1;
      return { quote, score };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || a.quote.shortname.length - b.quote.shortname.length)
    .slice(0, 8)
    .map((match) => match.quote);
}

async function searchSymbols(query) {
  const searchTerm = query.trim();
  if (!searchTerm) {
    closeSearchResults();
    return;
  }

  searchRequest?.abort();
  searchRequest = new AbortController();
  showSearchMessage("搜尋中…");

  try {
    if (/[\u3400-\u9fff]/u.test(searchTerm)) {
      renderSearchResults(await searchTaiwanCompanies(searchTerm));
      return;
    }

    const params = new URLSearchParams({
      q: searchTerm,
      quotesCount: "8",
      newsCount: "0",
      enableFuzzyQuery: "false"
    });
    const response = await fetch(`https://query2.finance.yahoo.com/v1/finance/search?${params}`, {
      cache: "no-store",
      signal: searchRequest.signal
    });

    if (!response.ok) throw new Error(`搜尋服務回傳 ${response.status}`);

    const payload = await response.json();
    const results = (payload.quotes || [])
      .filter((quote) => quote.symbol && ["EQUITY", "ETF"].includes(quote.quoteType))
      .slice(0, 8);
    renderSearchResults(results);
  } catch (error) {
    if (error.name !== "AbortError") {
      showSearchMessage(`無法搜尋：${error.message}`);
    }
  }
}

function getPortableData() {
  return portableStore.normalizePortableData({
    trackedQuotes,
    quotePages,
    currentPageId,
    pageNames,
    preferredSite
  });
}

async function saveTrackedQuotes({ touch = true, queueSync = true } = {}) {
  if (touch) portableUpdatedAt = Date.now();
  await chrome.storage.local.set({
    trackedQuotes,
    quotePages,
    currentPageId,
    pageNames,
    preferredSite,
    portableUpdatedAt,
    portableDeviceId,
    syncEnabled,
    syncJoined
  });
  if (touch && queueSync && syncEnabled && !applyingRemoteState) queuePortableSync();
}

function setSyncStatus(message, state = "") {
  elements.syncStatus.textContent = message;
  elements.syncStatus.className = `sync-status${state ? ` ${state}` : ""}`;
}

function setSyncBusy(busy) {
  elements.syncNow.disabled = busy || !syncEnabled;
  elements.exportData.disabled = busy;
  elements.importData.disabled = busy;
  elements.syncEnabled.disabled = busy;
}

function syncChunkKey(version, index) {
  return `${SYNC_CHUNK_PREFIX}.${version}.${index}`;
}

async function readSyncSnapshot() {
  const storedMeta = await chrome.storage.sync.get(SYNC_META_KEY);
  const meta = storedMeta[SYNC_META_KEY];
  if (!meta) return null;

  if (
    meta.format !== portableStore.FORMAT
    || meta.namespace !== portableStore.NAMESPACE
    || meta.schemaVersion !== portableStore.SCHEMA_VERSION
    || typeof meta.version !== "string"
    || !/^[a-zA-Z0-9-]{1,100}$/.test(meta.version)
    || !Number.isInteger(meta.chunkCount)
    || meta.chunkCount < 1
    || meta.chunkCount > 100
    || !Number.isFinite(Number(meta.updatedAt))
  ) {
    throw new Error("雲端存檔格式無效");
  }

  const keys = Array.from({ length: meta.chunkCount }, (_, index) => syncChunkKey(meta.version, index));
  const chunks = await chrome.storage.sync.get(keys);
  const serialized = keys.map((key) => chunks[key]);
  if (serialized.some((chunk) => typeof chunk !== "string")) throw new Error("雲端存檔缺少資料區塊");

  const joined = serialized.join("");
  if (portableStore.hashString(joined) !== meta.checksum) throw new Error("雲端存檔校驗失敗");

  let backup;
  try {
    backup = JSON.parse(joined);
  } catch {
    throw new Error("雲端存檔不是有效的 JSON");
  }

  return {
    data: portableStore.parseBackup(backup),
    updatedAt: Number(meta.updatedAt),
    deviceId: String(meta.deviceId || "")
  };
}

async function writeSyncSnapshot(data, updatedAt, deviceId) {
  const backup = portableStore.createBackup(data, updatedAt);
  const serialized = JSON.stringify(backup);
  const chunks = portableStore.splitForSync(serialized);
  const safeDeviceId = String(deviceId).replace(/[^a-zA-Z0-9-]/g, "").slice(0, 48) || "device";
  const version = `${updatedAt}-${safeDeviceId}`;
  const oldMeta = (await chrome.storage.sync.get(SYNC_META_KEY))[SYNC_META_KEY];
  const chunkData = Object.fromEntries(chunks.map((chunk, index) => [syncChunkKey(version, index), chunk]));
  const estimatedBytes = Object.entries(chunkData).reduce(
    (total, [key, value]) => total + new TextEncoder().encode(key).byteLength + portableStore.encodedStorageBytes(value),
    0
  );
  if (estimatedBytes > MAX_SYNC_SNAPSHOT_BYTES) {
    throw new Error("追蹤資料超過瀏覽器同步容量，請改用匯出檔案");
  }

  const activeVersion = typeof oldMeta?.version === "string" ? oldMeta.version : "";
  const allSyncItems = await chrome.storage.sync.get(null);
  const orphanKeys = Object.keys(allSyncItems).filter((key) => {
    const prefix = `${SYNC_CHUNK_PREFIX}.`;
    if (!key.startsWith(prefix) || key.startsWith(`${prefix}${activeVersion}.`)) return false;
    const versionTimestamp = Number(key.slice(prefix.length).match(/^(\d+)-/)?.[1]);
    return !Number.isFinite(versionTimestamp) || versionTimestamp < Date.now() - 60_000;
  });
  if (orphanKeys.length) await chrome.storage.sync.remove(orphanKeys);

  await chrome.storage.sync.set(chunkData);
  await chrome.storage.sync.set({
    [SYNC_META_KEY]: {
      format: portableStore.FORMAT,
      namespace: portableStore.NAMESPACE,
      schemaVersion: portableStore.SCHEMA_VERSION,
      version,
      chunkCount: chunks.length,
      checksum: portableStore.hashString(serialized),
      updatedAt,
      deviceId: safeDeviceId
    }
  });

  if (
    typeof oldMeta?.version === "string"
    && /^[a-zA-Z0-9-]{1,100}$/.test(oldMeta.version)
    && oldMeta.version !== version
    && Number.isInteger(oldMeta.chunkCount)
    && oldMeta.chunkCount > 0
    && oldMeta.chunkCount <= 100
  ) {
    const staleKeys = Array.from({ length: oldMeta.chunkCount }, (_, index) => syncChunkKey(oldMeta.version, index));
    await chrome.storage.sync.remove(staleKeys);
  }
}

function queuePortableSync() {
  pendingSyncWrite = {
    snapshot: getPortableData(),
    updatedAt: portableUpdatedAt,
    deviceId: portableDeviceId
  };
  setSyncStatus("等待同步…");
  window.clearTimeout(syncWriteTimer);
  syncWriteTimer = window.setTimeout(() => {
    const write = pendingSyncWrite;
    pendingSyncWrite = null;
    syncWriteChain = syncWriteChain
      .catch(() => {})
      .then(() => writeSyncSnapshot(write.snapshot, write.updatedAt, write.deviceId))
      .then(() => setSyncStatus("已同步最新存檔", "success"))
      .catch((error) => setSyncStatus(`同步失敗：${error.message}`, "error"));
  }, 250);
}

async function applyPortableData(data, updatedAt) {
  const normalized = portableStore.normalizePortableData(data);
  const previous = getPortableData();
  const previousUpdatedAt = portableUpdatedAt;
  applyingRemoteState = true;
  try {
    abortAllQuoteRequests();
    trackedQuotes = normalized.trackedQuotes;
    quotePages = normalized.quotePages;
    currentPageId = normalized.currentPageId;
    pageNames = normalized.pageNames;
    preferredSite = normalized.preferredSite;
    portableUpdatedAt = updatedAt;
    elements.stockSite.value = preferredSite;
    elements.pageName.value = pageNames[currentPageId] || "";
    await clearIconBadge().catch(() => {});
    await saveTrackedQuotes({ touch: false, queueSync: false });
    renderTrackedQuotes();
    restartPolling();
  } catch (error) {
    trackedQuotes = previous.trackedQuotes;
    quotePages = previous.quotePages;
    currentPageId = previous.currentPageId;
    pageNames = previous.pageNames;
    preferredSite = previous.preferredSite;
    portableUpdatedAt = previousUpdatedAt;
    elements.stockSite.value = preferredSite;
    elements.pageName.value = pageNames[currentPageId] || "";
    await saveTrackedQuotes({ touch: false, queueSync: false }).catch(() => {});
    renderTrackedQuotes();
    restartPolling();
    throw error;
  } finally {
    applyingRemoteState = false;
  }
}

async function applyNewerRemoteSnapshot() {
  if (!syncEnabled || applyingRemoteState) return;
  try {
    const remote = await readSyncSnapshot();
    if (!remote || remote.updatedAt <= portableUpdatedAt || remote.deviceId === portableDeviceId) return;
    await applyPortableData(remote.data, remote.updatedAt);
    setSyncStatus("已收到另一台裝置的最新存檔", "success");
  } catch (error) {
    setSyncStatus(`讀取雲端更新失敗：${error.message}`, "error");
  }
}

async function reconcilePortableSync() {
  setSyncBusy(true);
  setSyncStatus("正在比對本機與雲端存檔…");
  try {
    const remote = await readSyncSnapshot();
    if (remote && (!syncJoined || remote.updatedAt > portableUpdatedAt)) {
      syncJoined = true;
      await applyPortableData(remote.data, remote.updatedAt);
      await chrome.storage.local.set({ syncJoined: true });
      setSyncStatus("已套用較新的雲端存檔", "success");
      return;
    }

    if (!portableUpdatedAt) {
      portableUpdatedAt = Date.now();
      await saveTrackedQuotes({ touch: false, queueSync: false });
    }
    await writeSyncSnapshot(getPortableData(), portableUpdatedAt, portableDeviceId);
    syncJoined = true;
    await chrome.storage.local.set({ syncJoined: true });
    setSyncStatus(remote ? "本機已是最新版本" : "已建立雲端存檔", "success");
  } catch (error) {
    setSyncStatus(`同步失敗：${error.message}`, "error");
  } finally {
    setSyncBusy(false);
  }
}

function downloadPortableBackup() {
  const backup = portableStore.createBackup(getPortableData());
  const blob = new Blob([`${JSON.stringify(backup, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `stockticker-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

async function importPortableBackup(file) {
  if (file.size > MAX_IMPORT_BYTES) throw new Error("匯入檔案超過 1 MB");
  if (file.name && !file.name.toLowerCase().endsWith(".json") && file.type !== "application/json") {
    throw new Error("請選擇 JSON 存檔");
  }

  let payload;
  try {
    payload = JSON.parse(await file.text());
  } catch {
    throw new Error("匯入檔案不是有效的 JSON");
  }

  const data = portableStore.parseBackup(payload);
  const importedAt = Date.now();
  await applyPortableData(data, importedAt);
  if (syncEnabled) queuePortableSync();
}

function getCurrentPageQuotes() {
  return trackedQuotes.filter((quote) => quote.pageId === currentPageId);
}

function renderPageTabs() {
  elements.pageTabs.replaceChildren();

  quotePages.forEach((pageId, index) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "page-tab";
    tab.dataset.pageId = pageId;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(pageId === currentPageId));
    const displayName = pageNames[pageId] || String(index + 1);
    tab.title = `${displayName}；可將卡片拖到這裡`;

    const label = document.createElement("span");
    label.textContent = displayName;
    tab.append(label);
    elements.pageTabs.append(tab);
  });
}

async function validateStockSymbol(symbol) {
  const request = new AbortController();
  const timeout = window.setTimeout(() => request.abort(), 8_000);

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`;
    const response = await fetch(url, { cache: "no-store", signal: request.signal });
    if (!response.ok) throw new Error(response.status === 404 ? "找不到這個股票代號" : `驗證服務回傳 ${response.status}`);

    const payload = await response.json();
    const chart = payload?.chart;
    const meta = chart?.result?.[0]?.meta;
    if (chart?.error || !meta || !Number.isFinite(Number(meta.regularMarketPrice))) {
      throw new Error(chart?.error?.description || "找不到有效報價");
    }
    return meta;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("驗證逾時，未加入股票");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function renderTrackedQuotes() {
  renderPageTabs();
  quoteCards.clear();
  elements.quoteList.replaceChildren();

  getCurrentPageQuotes().forEach((quote) => {
    const card = elements.quoteTemplate.content.firstElementChild.cloneNode(true);
    card.dataset.symbol = quote.symbol;
    card.querySelector(".quote-symbol").textContent = quote.symbol.replace(/\.(TW|TWO)$/i, "");
    card.querySelector(".quote-name").textContent = quote.name || "";
    elements.quoteList.append(card);
    quoteCards.set(quote.symbol, card);
  });
}

async function addTrackedQuote(symbol, name = "") {
  const normalizedSymbol = normalizeSymbol(symbol);
  const existing = trackedQuotes.find((quote) => quote.symbol === normalizedSymbol);

  if (existing) {
    const movedToCurrentPage = existing.pageId !== currentPageId;
    const nameUpdated = !existing.name && Boolean(name);
    if (movedToCurrentPage) existing.pageId = currentPageId;
    if (nameUpdated) existing.name = name;
    elements.symbolInput.value = "";
    closeSearchResults();
    if (movedToCurrentPage || nameUpdated) {
      await saveTrackedQuotes();
      renderTrackedQuotes();
    }
    if (movedToCurrentPage) {
      restartPolling();
      return;
    }
    await refreshSingleQuote(existing);
    return;
  }

  const addButton = elements.form.querySelector(".add-button");
  addButton.disabled = true;
  setStatus("loading", "驗證中");
  try {
    await validateStockSymbol(normalizedSymbol);
  } catch (error) {
    showError(`${normalizedSymbol}：${error.message}`);
    setStatus("error", "無此股票");
    return;
  } finally {
    addButton.disabled = false;
  }

  trackedQuotes.push({ symbol: normalizedSymbol, name, pageId: currentPageId });
  elements.symbolInput.value = "";
  closeSearchResults();
  await saveTrackedQuotes();
  renderTrackedQuotes();
  restartPolling();
}

async function removeTrackedQuote(symbol) {
  const removedTopQuote = getCurrentPageQuotes()[0]?.symbol === symbol;
  activeRequests.get(symbol)?.abort();
  activeRequests.delete(symbol);
  trackedQuotes = trackedQuotes.filter((quote) => quote.symbol !== symbol);
  if (removedTopQuote) await clearIconBadge().catch(() => {});
  await saveTrackedQuotes();
  renderTrackedQuotes();
  restartPolling();
}

async function commitDraggedOrder() {
  if (!draggedSymbol) return;

  const currentQuotes = getCurrentPageQuotes();
  const previousOrder = currentQuotes.map((quote) => quote.symbol).join("|");
  const order = [...elements.quoteList.querySelectorAll(".quote-card")]
    .map((card) => card.dataset.symbol);
  const quotesBySymbol = new Map(currentQuotes.map((quote) => [quote.symbol, quote]));
  const orderedCurrentQuotes = order.map((symbol) => quotesBySymbol.get(symbol)).filter(Boolean);
  const orderChanged = previousOrder !== orderedCurrentQuotes.map((quote) => quote.symbol).join("|");

  draggedSymbol = "";
  elements.quoteList.querySelector(".dragging")?.classList.remove("dragging");

  if (orderChanged) {
    trackedQuotes = quotePages.flatMap((pageId) =>
      pageId === currentPageId
        ? orderedCurrentQuotes
        : trackedQuotes.filter((quote) => quote.pageId === pageId)
    );
    await clearIconBadge().catch(() => {});
    await saveTrackedQuotes();
    restartPolling();
  }
}

async function switchPage(pageId) {
  if (!quotePages.includes(pageId) || pageId === currentPageId) return;
  abortAllQuoteRequests();
  currentPageId = pageId;
  elements.pageName.value = pageNames[currentPageId] || "";
  await clearIconBadge().catch(() => {});
  await saveTrackedQuotes();
  renderTrackedQuotes();
  restartPolling();
}

async function addTrackingPage() {
  abortAllQuoteRequests();
  const pageId = `page-${Date.now().toString(36)}`;
  quotePages.push(pageId);
  currentPageId = pageId;
  elements.pageName.value = "";
  await saveTrackedQuotes();
  renderTrackedQuotes();
  restartPolling();
}

async function moveQuoteToPage(symbol, targetPageId) {
  const quote = trackedQuotes.find((item) => item.symbol === symbol);
  if (!quote || !quotePages.includes(targetPageId) || quote.pageId === targetPageId) return;

  activeRequests.get(symbol)?.abort();
  activeRequests.delete(symbol);
  abortAllQuoteRequests();
  quote.pageId = targetPageId;
  currentPageId = targetPageId;
  draggedSymbol = "";
  document.querySelectorAll(".page-tab.drag-target").forEach((tab) => tab.classList.remove("drag-target"));
  await clearIconBadge().catch(() => {});
  await saveTrackedQuotes();
  renderTrackedQuotes();
  restartPolling();
}

function getStockPageUrl(quote) {
  const isTaiwanStock = /\.(TW|TWO)$/i.test(quote.symbol);
  const code = quote.symbol.replace(/\.(TW|TWO)$/i, "");
  if (preferredSite === "wantgoo" && isTaiwanStock) {
    return `https://www.wantgoo.com/stock/${encodeURIComponent(code)}`;
  }
  return `https://tw.stock.yahoo.com/quote/${encodeURIComponent(quote.symbol)}`;
}

function openStockPage(quote) {
  void chrome.tabs.create({ url: getStockPageUrl(quote) }).catch(() => {});
}

async function selectMatch(quote) {
  await addTrackedQuote(quote.symbol, quote.shortname || quote.longname || "");
}

async function resolveNumericTaiwanSymbol(value) {
  if (!/^\d{4,6}$/.test(value)) return { symbol: value, name: "" };

  try {
    const listings = await loadTaiwanListings();
    const listing = listings.find((quote) => quote.symbol.split(".")[0] === value);
    if (listing) {
      return {
        symbol: listing.symbol,
        name: listing.shortname || listing.longname || ""
      };
    }
  } catch {
    // 官方清單暫時無法取得時，以下市代號作為備援。
  }

  return { symbol: `${value}.TW`, name: "" };
}

async function resolveCompanyName(quote, meta) {
  const isTaiwanStock = /\.(TW|TWO)$/i.test(quote.symbol);
  const hasChineseName = /[\u3400-\u9fff]/u.test(quote.name);

  if (quote.name && (!isTaiwanStock || hasChineseName)) return quote.name;

  if (isTaiwanStock) {
    try {
      const listings = await loadTaiwanListings();
      const listing = listings.find((item) => item.symbol.toUpperCase() === quote.symbol);
      if (listing) quote.name = listing.shortname || listing.longname || "";
    } catch {
      // 名稱載入失敗時仍正常顯示報價與代號。
    }
  }

  if (!quote.name) quote.name = meta.shortName || meta.longName || "";
  if (quote.name) await saveTrackedQuotes();
  return quote.name;
}

function createSvgElement(tagName, attributes) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tagName);
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
  return element;
}

function renderMiniChart(card, chartResult) {
  const svg = card.querySelector(".mini-chart");
  const content = svg.querySelector(".chart-content");
  const series = chartResult?.indicators?.quote?.[0];
  content.replaceChildren();

  if (!series) return;

  const candles = (chartResult.timestamp || [])
    .map((timestamp, index) => ({
      timestamp,
      open: series.open?.[index] == null ? NaN : Number(series.open[index]),
      high: series.high?.[index] == null ? NaN : Number(series.high[index]),
      low: series.low?.[index] == null ? NaN : Number(series.low[index]),
      close: series.close?.[index] == null ? NaN : Number(series.close[index]),
      volume: Number(series.volume?.[index]) || 0
    }))
    .filter((candle) => [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite))
    .slice(-16);

  if (!candles.length) return;

  const width = 92;
  const priceTop = 1;
  const priceBottom = 23;
  const volumeTop = 27;
  const chartBottom = 34;
  const lowest = Math.min(...candles.map((candle) => candle.low));
  const highest = Math.max(...candles.map((candle) => candle.high));
  const priceRange = highest - lowest || 1;
  const maxVolume = Math.max(...candles.map((candle) => candle.volume), 1);
  const slotWidth = width / candles.length;
  const bodyWidth = Math.max(1.2, Math.min(3.6, slotWidth * 0.55));
  const priceY = (value) => priceBottom - ((value - lowest) / priceRange) * (priceBottom - priceTop);

  content.append(createSvgElement("line", {
    x1: 0,
    y1: 25.5,
    x2: width,
    y2: 25.5,
    class: "chart-divider"
  }));

  candles.forEach((candle, index) => {
    const x = (index + 0.5) * slotWidth;
    const color = candle.close > candle.open ? "#ff5f70" : candle.close < candle.open ? "#35d6a3" : "#8794ad";
    const volumeHeight = Math.max(0.6, (candle.volume / maxVolume) * (chartBottom - volumeTop));
    const bodyTop = priceY(Math.max(candle.open, candle.close));
    const bodyBottom = priceY(Math.min(candle.open, candle.close));

    content.append(createSvgElement("rect", {
      x: x - bodyWidth / 2,
      y: chartBottom - volumeHeight,
      width: bodyWidth,
      height: volumeHeight,
      fill: color,
      class: "volume-bar"
    }));
    content.append(createSvgElement("line", {
      x1: x,
      y1: priceY(candle.high),
      x2: x,
      y2: priceY(candle.low),
      stroke: color,
      class: "candle-wick"
    }));
    content.append(createSvgElement("rect", {
      x: x - bodyWidth / 2,
      y: bodyTop,
      width: bodyWidth,
      height: Math.max(1, bodyBottom - bodyTop),
      fill: color,
      rx: 0.3
    }));
  });

  svg.setAttribute("aria-label", `${quoteLabel(card)}最近 ${candles.length} 根一分鐘 K 線與成交量`);
}

function quoteLabel(card) {
  return `${card.querySelector(".quote-symbol").textContent} ${card.querySelector(".quote-name").textContent} `;
}

function renderQuote(card, quote, meta, companyName, chartResult) {
  const price = Number(meta.regularMarketPrice);
  const previousClose = Number(meta.chartPreviousClose ?? meta.previousClose);
  const difference = price - previousClose;
  const percent = previousClose ? (difference / previousClose) * 100 : 0;
  const direction = difference > 0 ? "positive" : difference < 0 ? "negative" : "neutral";
  const sign = difference > 0 ? "+" : "";

  const change = card.querySelector(".change");
  card.querySelector(".quote-symbol").textContent = (meta.symbol || quote.symbol).replace(/\.(TW|TWO)$/i, "");
  card.querySelector(".quote-name").textContent = companyName || "";
  card.setAttribute("aria-label", `${quote.symbol.replace(/\.(TW|TWO)$/i, "")} ${companyName || ""}，點擊開啟股票頁`.trim());
  card.querySelector(".currency").textContent = meta.currency || "";
  card.querySelector(".price").textContent = formatNumber(price, meta.currency);
  change.className = `change ${direction}`;
  change.textContent = `${sign}${formatNumber(difference, meta.currency)} (${sign}${percent.toFixed(2)}%)`;
  renderMiniChart(card, chartResult);
  elements.updatedAt.textContent = new Intl.DateTimeFormat("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date());
  return { price, direction };
}

async function fetchQuote(quote) {
  const card = quoteCards.get(quote.symbol);
  if (!card) return { ok: false, error: "找不到報價卡" };

  activeRequests.get(quote.symbol)?.abort();
  const request = new AbortController();
  activeRequests.set(quote.symbol, request);
  setCardLoading(card, true);

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(quote.symbol)}?interval=1m&range=1d`;
    const response = await fetch(url, {
      cache: "no-store",
      signal: request.signal
    });

    if (!response.ok) {
      throw new Error(`報價服務回傳 ${response.status}`);
    }

    const payload = await response.json();
    const chart = payload?.chart;
    const meta = chart?.result?.[0]?.meta;

    if (chart?.error || !meta || !Number.isFinite(Number(meta.regularMarketPrice))) {
      throw new Error(chart?.error?.description || "找不到這個股票代號");
    }

    const companyName = await resolveCompanyName(quote, meta);
    const rendered = renderQuote(card, quote, meta, companyName, chart.result[0]);
    await updateIconBadge(quote, rendered.price, rendered.direction, meta.currency || "", companyName);
    return { ok: true };
  } catch (error) {
    if (error.name === "AbortError") return { ok: false, aborted: true };
    return { ok: false, error: `${quote.symbol}：${error.message}` };
  } finally {
    setCardLoading(card, false);
  }
}

async function refreshSingleQuote(quote) {
  setStatus("loading", "更新中");
  const result = await fetchQuote(quote);
  if (result.ok) {
    clearError();
    setStatus("online", "已連線");
  } else if (!result.aborted) {
    showError(result.error);
  }
}

async function fetchAllQuotes() {
  const currentQuotes = getCurrentPageQuotes();
  setStatus("loading", "更新中");
  const results = await Promise.all(currentQuotes.map(fetchQuote));
  const failures = results.filter((result) => !result.ok && !result.aborted);

  if (!failures.length) {
    clearError();
    setStatus("online", "已連線");
    return;
  }

  elements.error.textContent = failures.map((result) => result.error).join("\n");
  elements.error.hidden = false;
  setStatus(failures.length === currentQuotes.length ? "error" : "online", failures.length === currentQuotes.length ? "更新失敗" : "部分失敗");
}

function restartPolling() {
  window.clearInterval(updateTimer);
  if (!getCurrentPageQuotes().length) {
    clearError();
    elements.updatedAt.textContent = "—";
    setStatus("idle", "尚無股票");
    void clearIconBadge().catch(() => {});
    return;
  }
  fetchAllQuotes();
  updateTimer = window.setInterval(fetchAllQuotes, UPDATE_INTERVAL_MS);
}

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const symbol = normalizeSymbol(elements.symbolInput.value);

  if (!symbol) return;

  if (activeMatchIndex >= 0 && matches[activeMatchIndex]) {
    await selectMatch(matches[activeMatchIndex]);
    return;
  }

  const containsChinese = /[\u3400-\u9fff]/u.test(symbol);
  if (containsChinese) {
    await searchSymbols(elements.symbolInput.value);
    return;
  }

  const resolved = await resolveNumericTaiwanSymbol(symbol);
  await addTrackedQuote(resolved.symbol, resolved.name);
});

elements.symbolInput.addEventListener("input", () => {
  window.clearTimeout(searchTimer);
  const query = elements.symbolInput.value.trim();
  if (!query) {
    closeSearchResults();
    return;
  }
  searchTimer = window.setTimeout(() => searchSymbols(query), 350);
});

elements.symbolInput.addEventListener("keydown", (event) => {
  if (elements.searchResults.hidden) return;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    setActiveMatch(activeMatchIndex + 1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    setActiveMatch(activeMatchIndex - 1);
  } else if (event.key === "Escape") {
    closeSearchResults();
  }
});

elements.searchResults.addEventListener("click", (event) => {
  const option = event.target.closest(".search-option");
  if (!option) return;
  const match = matches[Number(option.dataset.index)];
  if (match) selectMatch(match);
});

document.addEventListener("click", (event) => {
  if (!elements.form.contains(event.target)) closeSearchResults();
});

elements.pageTabs.addEventListener("click", (event) => {
  const tab = event.target.closest(".page-tab");
  if (tab && !draggedSymbol) void switchPage(tab.dataset.pageId);
});

elements.addPage.addEventListener("click", () => {
  void addTrackingPage();
});

elements.pageTabs.addEventListener("dragover", (event) => {
  const tab = event.target.closest(".page-tab");
  if (!tab || !draggedSymbol) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  elements.pageTabs.querySelectorAll(".drag-target").forEach((item) => item.classList.remove("drag-target"));
  tab.classList.add("drag-target");
});

elements.pageTabs.addEventListener("dragleave", (event) => {
  const tab = event.target.closest(".page-tab");
  if (tab && !tab.contains(event.relatedTarget)) tab.classList.remove("drag-target");
});

elements.pageTabs.addEventListener("drop", (event) => {
  const tab = event.target.closest(".page-tab");
  if (!tab || !draggedSymbol) return;
  event.preventDefault();
  event.stopPropagation();
  void moveQuoteToPage(draggedSymbol, tab.dataset.pageId);
});

elements.settingsToggle.addEventListener("click", () => {
  const willOpen = elements.settingsPanel.hidden;
  elements.settingsPanel.hidden = !willOpen;
  elements.settingsToggle.setAttribute("aria-expanded", String(willOpen));
});

elements.stockSite.addEventListener("change", async () => {
  preferredSite = elements.stockSite.value === "wantgoo" ? "wantgoo" : "yahoo";
  await saveTrackedQuotes();
});

elements.syncEnabled.addEventListener("change", async () => {
  syncEnabled = elements.syncEnabled.checked;
  await saveTrackedQuotes({ touch: false, queueSync: false });
  if (syncEnabled) await reconcilePortableSync();
  else {
    window.clearTimeout(syncWriteTimer);
    pendingSyncWrite = null;
    setSyncBusy(false);
    setSyncStatus("同步已關閉，資料只儲存在本機");
  }
});

elements.syncNow.addEventListener("click", () => {
  if (syncEnabled) void reconcilePortableSync();
});

elements.exportData.addEventListener("click", () => {
  try {
    downloadPortableBackup();
    setSyncStatus("跨平台存檔已匯出", "success");
  } catch (error) {
    setSyncStatus(`匯出失敗：${error.message}`, "error");
  }
});

elements.importData.addEventListener("click", () => {
  elements.importFile.value = "";
  elements.importFile.click();
});

elements.importFile.addEventListener("change", async () => {
  const file = elements.importFile.files?.[0];
  if (!file) return;
  setSyncBusy(true);
  setSyncStatus("正在驗證並匯入存檔…");
  try {
    await importPortableBackup(file);
    setSyncStatus("存檔匯入完成，原有設定已安全替換", "success");
  } catch (error) {
    setSyncStatus(`匯入失敗：${error.message}；原有資料未變更`, "error");
  } finally {
    setSyncBusy(false);
  }
});

function saveCurrentPageName() {
  const name = Array.from(elements.pageName.value.trim()).slice(0, 3).join("");
  if (elements.pageName.value !== name) elements.pageName.value = name;

  if (name) pageNames[currentPageId] = name;
  else delete pageNames[currentPageId];

  renderPageTabs();
  void saveTrackedQuotes().catch(() => {
    showError("分頁名稱保存失敗，請再試一次");
  });
}

elements.pageName.addEventListener("input", (event) => {
  if (!event.isComposing) saveCurrentPageName();
});

elements.pageName.addEventListener("compositionend", saveCurrentPageName);
elements.pageName.addEventListener("change", saveCurrentPageName);
elements.pageName.addEventListener("blur", saveCurrentPageName);

elements.quoteList.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-action]");
  const card = event.target.closest(".quote-card");
  if (!card) return;
  const quote = trackedQuotes.find((item) => item.symbol === card.dataset.symbol);
  if (!quote) return;

  if (actionButton?.dataset.action === "remove") {
    removeTrackedQuote(quote.symbol);
  } else if (actionButton?.dataset.action === "refresh") {
    refreshSingleQuote(quote);
  } else if (!suppressCardClick) {
    openStockPage(quote);
  }
});

elements.quoteList.addEventListener("keydown", (event) => {
  if (!["Enter", " "].includes(event.key) || event.target.closest("button")) return;
  const card = event.target.closest(".quote-card");
  const quote = trackedQuotes.find((item) => item.symbol === card?.dataset.symbol);
  if (!quote) return;
  event.preventDefault();
  openStockPage(quote);
});

elements.quoteList.addEventListener("dragstart", (event) => {
  const card = event.target.closest(".quote-card");
  if (!card || dragBlocked) {
    event.preventDefault();
    return;
  }

  draggedSymbol = card.dataset.symbol;
  suppressCardClick = true;
  card.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", draggedSymbol);
});

elements.quoteList.addEventListener("dragover", (event) => {
  if (!draggedSymbol) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";

  const draggedCard = elements.quoteList.querySelector(".dragging");
  const targetCard = event.target.closest(".quote-card");
  if (!draggedCard) return;

  if (!targetCard) {
    elements.quoteList.append(draggedCard);
    return;
  }
  if (targetCard === draggedCard) return;

  const targetBounds = targetCard.getBoundingClientRect();
  const insertBefore = event.clientY < targetBounds.top + targetBounds.height / 2;
  elements.quoteList.insertBefore(draggedCard, insertBefore ? targetCard : targetCard.nextSibling);
});

elements.quoteList.addEventListener("drop", (event) => {
  if (!draggedSymbol) return;
  event.preventDefault();
  void commitDraggedOrder();
});

elements.quoteList.addEventListener("dragend", () => {
  dragBlocked = false;
  elements.pageTabs.querySelectorAll(".drag-target").forEach((tab) => tab.classList.remove("drag-target"));
  void commitDraggedOrder();
  window.setTimeout(() => {
    suppressCardClick = false;
  }, 0);
});

elements.quoteList.addEventListener("pointerdown", (event) => {
  dragBlocked = Boolean(event.target.closest("button"));
});

elements.quoteList.addEventListener("pointerup", () => {
  dragBlocked = false;
});

elements.quoteList.addEventListener("pointercancel", () => {
  dragBlocked = false;
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes[SYNC_META_KEY]) void applyNewerRemoteSnapshot();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") restartPolling();
});

async function initialize() {
  const stored = await chrome.storage.local.get([
    "trackedQuotes",
    "quotePages",
    "currentPageId",
    "pageNames",
    "portableUpdatedAt",
    "portableDeviceId",
    "syncEnabled",
    "syncJoined",
    "symbol",
    "companyName",
    "preferredSite"
  ]);
  const hasSavedQuotes = Array.isArray(stored.trackedQuotes);
  const savedQuotes = hasSavedQuotes ? stored.trackedQuotes : [];
  const legacyQuote = {
    symbol: normalizeSymbol(stored.symbol || DEFAULT_SYMBOL),
    name: stored.companyName || ""
  };

  quotePages = Array.isArray(stored.quotePages) && stored.quotePages.length
    ? [...new Set(stored.quotePages.filter((pageId) => typeof pageId === "string" && pageId))]
    : ["page-1"];
  if (!quotePages.length) quotePages = ["page-1"];
  currentPageId = quotePages.includes(stored.currentPageId) ? stored.currentPageId : quotePages[0];
  pageNames = stored.pageNames && typeof stored.pageNames === "object"
    ? Object.fromEntries(
      Object.entries(stored.pageNames)
        .filter(([pageId, name]) => quotePages.includes(pageId) && typeof name === "string")
        .map(([pageId, name]) => [pageId, Array.from(name.trim()).slice(0, 3).join("")])
        .filter(([, name]) => name)
    )
    : {};

  trackedQuotes = (hasSavedQuotes ? savedQuotes : [legacyQuote])
    .map((quote) => ({
      symbol: normalizeSymbol(quote.symbol),
      name: quote.name || "",
      pageId: quotePages.includes(quote.pageId) ? quote.pageId : quotePages[0]
    }))
    .filter((quote, index, list) => quote.symbol && list.findIndex((item) => item.symbol === quote.symbol) === index);

  preferredSite = stored.preferredSite === "wantgoo" ? "wantgoo" : "yahoo";
  const savedUpdatedAt = Number(stored.portableUpdatedAt);
  portableUpdatedAt = Number.isFinite(savedUpdatedAt) && savedUpdatedAt > 0 ? savedUpdatedAt : Date.now();
  const savedDeviceId = typeof stored.portableDeviceId === "string"
    ? stored.portableDeviceId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 48)
    : "";
  portableDeviceId = savedDeviceId || (crypto.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  syncEnabled = Boolean(stored.syncEnabled);
  syncJoined = Boolean(stored.syncJoined);
  elements.stockSite.value = preferredSite;
  elements.pageName.value = pageNames[currentPageId] || "";
  elements.syncEnabled.checked = syncEnabled;
  elements.symbolInput.value = "";
  await saveTrackedQuotes({ touch: false, queueSync: false });
  renderTrackedQuotes();
  restartPolling();
  if (syncEnabled) await reconcilePortableSync();
  else {
    setSyncBusy(false);
    setSyncStatus("資料目前只儲存在本機");
  }
}

initialize();
