const test = require("node:test");
const assert = require("node:assert/strict");
const portable = require("../portable-store.js");

function sampleData() {
  return {
    trackedQuotes: [
      { symbol: "2330.TW", name: "台積電", pageId: "page-1" },
      { symbol: "AAPL", name: "Apple Inc.", pageId: "page-2" }
    ],
    quotePages: ["page-1", "page-2"],
    currentPageId: "page-2",
    pageNames: { "page-1": "台股", "page-2": "美股" },
    preferredSite: "yahoo"
  };
}

test("exports and imports a browser-independent backup", () => {
  const backup = portable.createBackup(sampleData(), Date.UTC(2026, 7, 10));
  const transferred = JSON.parse(JSON.stringify(backup));
  assert.equal(transferred.format, portable.FORMAT);
  assert.equal(transferred.namespace, portable.NAMESPACE);
  assert.deepEqual(portable.parseBackup(transferred), sampleData());
});

test("rejects a different namespace", () => {
  const backup = portable.createBackup(sampleData());
  backup.namespace = "another.extension";
  assert.throws(() => portable.parseBackup(backup), (error) => error.code === "NAMESPACE_MISMATCH");
});

test("rejects invalid backup metadata", () => {
  const backup = portable.createBackup(sampleData());
  backup.exportedAt = "not-a-date";
  assert.throws(() => portable.parseBackup(backup), (error) => error.code === "INVALID_METADATA");
});

test("rejects duplicate symbols and page names over three characters", () => {
  const duplicate = sampleData();
  duplicate.trackedQuotes.push({ ...duplicate.trackedQuotes[0] });
  assert.throws(() => portable.normalizePortableData(duplicate), (error) => error.code === "INVALID_QUOTES");

  const longName = sampleData();
  longName.pageNames["page-1"] = "超過三字";
  assert.throws(() => portable.normalizePortableData(longName), (error) => error.code === "INVALID_PAGE_NAMES");
});

test("sync chunks reassemble with the same checksum", () => {
  const serialized = JSON.stringify(portable.createBackup(sampleData()));
  const chunks = portable.splitForSync(serialized, 17);
  assert.ok(chunks.length > 1);
  assert.equal(chunks.join(""), serialized);
  assert.equal(portable.hashString(chunks.join("")), portable.hashString(serialized));
});

test("sync chunks respect encoded UTF-8 JSON size for Chinese text", () => {
  const serialized = JSON.stringify({ name: "台積電\\\"".repeat(2_000) });
  const chunks = portable.splitForSync(serialized);
  assert.ok(chunks.length > 1);
  assert.equal(chunks.join(""), serialized);
  assert.ok(chunks.every((chunk) => portable.encodedStorageBytes(chunk) <= portable.SYNC_CHUNK_SIZE));
});
