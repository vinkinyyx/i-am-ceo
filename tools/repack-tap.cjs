// 补丁后重新打包 Tap 小游戏 zip。
//
// 为什么需要：taptap-minigame-tools 的 convertWechatToTap 会重新生成 game.js /
// check-version.js（并在 game.js 头部注回 throw new Error('fetch is not defined')），
// 同时在转换阶段就把 build/TapBuild/game 打成了 game.zip。而启动兼容补丁只能在
// 转换之后打，因此必须重新打包，否则补丁不会进入包内。
//
// 注意：必须用跨平台 zip 工具（archiver）生成条目名，保证使用 '/' 分隔；
// PowerShell 的 ZipFile.CreateFromDirectory 会写入 '\' 分隔的条目名，
// 真机解包时容易被当成字面文件名而导致资源找不到。
//
// 用法：node tools/repack-tap.cjs
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const ext = path.join(root, 'extensions', 'taptap-minigame-tools');
module.paths.push(path.join(ext, 'node_modules'));
const archiver = require(path.join(ext, 'node_modules', 'archiver'));

const srcDir = path.join(root, 'build', 'TapBuild', 'game');
const zipPath = path.join(root, 'build', 'TapBuild', 'game.zip');

if (!fs.existsSync(srcDir)) {
  console.error('REPACK_FAIL 缺少 build/TapBuild/game');
  process.exit(1);
}

if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

const out = fs.createWriteStream(zipPath);
const zip = archiver('zip', { zlib: { level: 9 } });

out.on('close', () => {
  const bytes = zip.pointer();
  console.log(`REPACK_OK ${Math.round(bytes / 1024)} KB (${bytes} bytes) -> build/TapBuild/game.zip`);
});
zip.on('warning', (e) => console.warn('REPACK_WARN', e && e.message));
zip.on('error', (e) => {
  console.error('REPACK_FAIL', e && e.message);
  process.exit(1);
});

zip.pipe(out);
zip.directory(srcDir, false);
zip.finalize();
