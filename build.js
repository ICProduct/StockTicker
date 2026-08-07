const fs = require('fs');

// 將打包邏輯包裝在一個非同步函式中
async function runBuild() {
    try {
        // archiver v8 改為具名 export，使用 ZipArchive 類別直接建立 zip 壓縮
        const { ZipArchive } = await import('archiver');

        const output = fs.createWriteStream(__dirname + '/extension-release.zip');
        const archive = new ZipArchive({ zlib: { level: 9 } });

        output.on('close', function() {
            console.log(`✅ 打包完成！產生檔案：extension-release.zip`);
            console.log(`📦 檔案大小：${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
        });

        archive.on('error', function(err) {
            throw err;
        });

        archive.pipe(output);

        // 加入要打包的檔案，並過濾掉不需要的開發檔案
        archive.glob('**/*', {
            cwd: __dirname,
            ignore: [
                '.git/**',
                'node_modules/**',
                '*.zip',
                'build.js',
                'package.json',
                'package-lock.json',
                '.gitignore'
            ]
        });

        await archive.finalize();
    } catch (err) {
        console.error('❌ 打包過程中發生錯誤：', err);
        process.exit(1);
    }
}

// 執行打包程式
runBuild();