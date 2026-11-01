// R0-02：调用 taptap-minigame-tools 转换器，把 build/wechatgame 转为 build/TapBuild/game.zip。
// 用法：node tools/convert-tap.cjs [gameVersion]
const path = require('path');
const root = path.join(__dirname, '..');
const ext = path.join(root, 'extensions', 'taptap-minigame-tools');
module.paths.push(path.join(ext, 'node_modules'));
const { convertWechatToTap } = require(path.join(ext, 'dist', 'converter-ts.js'));

convertWechatToTap({
  source: path.join(root, 'build', 'wechatgame'),
  target: path.join(root, 'build', 'TapBuild'),
  useSubpackage: false,
  gameVersion: process.argv[2] || '1.0.0',
})
  .then(() => console.log('CONVERT_OK'))
  .catch((e) => {
    console.error('CONVERT_FAIL', e && e.message);
    process.exit(1);
  });
