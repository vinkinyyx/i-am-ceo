// R19：转换 wechatgame 构建为 Tap 包（参数化输入/输出，不复用固定目录）。
// 用法：node tools/convert-tap-v2.cjs <gameVersion> <wxDir> <tapDir>
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const ext = path.join(root, 'extensions', 'taptap-minigame-tools');
module.paths.push(path.join(ext, 'node_modules'));
const { convertWechatToTap } = require(path.join(ext, 'dist', 'converter-ts.js'));

const [gameVersion, wxDir, tapDir] = process.argv.slice(2);
if (!gameVersion || !wxDir || !tapDir) {
  console.error('CONVERT_FAIL usage: convert-tap-v2 <version> <wxDir> <tapDir>');
  process.exit(2);
}
if (!/^\d+\.\d+\.\d+$/.test(gameVersion)) {
  console.error('CONVERT_FAIL gameVersion must match x.y.z');
  process.exit(2);
}
if (!fs.existsSync(path.join(wxDir, 'game.json'))) {
  console.error('CONVERT_FAIL missing game.json in', wxDir);
  process.exit(2);
}

convertWechatToTap({
  source: wxDir,
  target: tapDir,
  useSubpackage: false,
  gameVersion,
})
  .then(() => console.log('CONVERT_OK'))
  .catch((e) => {
    console.error('CONVERT_FAIL', e && e.message);
    process.exit(1);
  });
