const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const RELEASE_FILES = [
  "manifest.json",
  "popup.html",
  "popup.css",
  "popup.js",
  "portable-store.js",
  "search-utils.js",
  "icon/16.png",
  "icon/32.png",
  "icon/64.png",
  "icon/128.png"
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, relativePath), "utf8"));
}

function validateRelease(manifest, packageJson) {
  if (manifest.manifest_version !== 3) throw new Error("manifest.json 必須使用 Manifest V3");
  if (!/^\d+(?:\.\d+){0,3}$/.test(manifest.version || "")) throw new Error("manifest.json 版本格式無效");
  if (packageJson.version !== manifest.version) {
    throw new Error(`package.json (${packageJson.version}) 與 manifest.json (${manifest.version}) 版本不一致`);
  }

  for (const relativePath of RELEASE_FILES) {
    const absolutePath = path.join(__dirname, relativePath);
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      throw new Error(`缺少發布檔案：${relativePath}`);
    }
  }
}

async function createZip(zipPath) {
  const { ZipArchive } = await import("archiver");
  const output = fs.createWriteStream(zipPath);
  const archive = new ZipArchive({ zlib: { level: 9 } });
  const completed = new Promise((resolve, reject) => {
    output.once("close", resolve);
    output.once("error", reject);
    archive.once("error", reject);
  });

  archive.pipe(output);
  for (const relativePath of RELEASE_FILES) {
    archive.file(path.join(__dirname, relativePath), { name: relativePath.replaceAll("\\", "/") });
  }

  await archive.finalize();
  await completed;
}

async function runBuild() {
  const manifest = readJson("manifest.json");
  const packageJson = readJson("package.json");
  validateRelease(manifest, packageJson);

  const buildDir = path.join(__dirname, "build");
  const baseName = `StockTicker-${manifest.version}`;
  const zipPath = path.join(buildDir, `${baseName}.zip`);
  const hashPath = path.join(buildDir, `${baseName}.sha256.txt`);
  fs.mkdirSync(buildDir, { recursive: true });

  await createZip(zipPath);

  const zipBuffer = fs.readFileSync(zipPath);
  const sha256 = crypto.createHash("sha256").update(zipBuffer).digest("hex").toUpperCase();
  fs.writeFileSync(hashPath, `${sha256}  ${path.basename(zipPath)}\n`, "utf8");

  console.log(`打包完成：${zipPath}`);
  console.log(`檔案數量：${RELEASE_FILES.length}`);
  console.log(`檔案大小：${zipBuffer.byteLength.toLocaleString("en-US")} bytes`);
  console.log(`SHA-256：${sha256}`);
}

runBuild().catch((error) => {
  console.error(`打包失敗：${error.message}`);
  process.exitCode = 1;
});
