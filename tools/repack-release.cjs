// R20：发布包唯一打包器（archiver，'/' 分隔条目；所有 zip 只经此工具生成）。
// 用法：node tools/repack-release.cjs <srcDir> <zipPath>
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const ext = path.join(root, 'extensions', 'taptap-minigame-tools');
module.paths.push(path.join(ext, 'node_modules'));
const archiver = require(path.join(ext, 'node_modules', 'archiver'));

const [srcDir, zipPath] = process.argv.slice(2);
if (!srcDir || !zipPath) {
  console.error('REPACK_FAIL usage');
  process.exit(2);
}
if (!fs.existsSync(path.join(srcDir, 'game.json'))) {
  console.error('REPACK_FAIL missing game.json in', srcDir);
  process.exit(1);
}
fs.mkdirSync(path.dirname(zipPath), { recursive: true });
if (fs.existsSync(zipPath)) {
  console.error('REPACK_FAIL 目标已存在，禁止原地覆盖：', zipPath);
  process.exit(1);
}

const out = fs.createWriteStream(zipPath);
const zip = archiver('zip', { zlib: { level: 9 } });
out.on('close', () => {
  console.log(`REPACK_OK ${zip.pointer()} ${zipPath}`);
});
zip.on('warning', (e) => console.warn('REPACK_WARN', e && e.message));
zip.on('error', (e) => {
  console.error('REPACK_FAIL', e && e.message);
  process.exit(1);
});
zip.pipe(out);
zip.directory(srcDir, false);
zip.finalize();
