// R19/R20/R21：发布流水线工具测试（ESM，Node 构建环境；不进业务 tsc）。
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const require = createRequire(import.meta.url);
const { readZipFile } = require(path.join(root, 'tools', 'lib', 'read-zip.cjs'));
const { getDirtyPaths } = require(path.join(root, 'tools', 'lib', 'git-dirty-paths.cjs'));

function runCjs(script, args) {
  try {
    const stdout = execFileSync('node', [path.join(root, script), ...args], {
      encoding: 'utf8',
      cwd: root,
    });
    return { stdout, code: 0 };
  } catch (err) {
    return { stdout: [err.stdout || '', err.stderr || ''].join('\n'), code: err.status || 1 };
  }
}

function makeFakeTapGame(dir) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'game.json'),
    JSON.stringify({
      deviceOrientation: 'portrait',
      productVersion: '1.0.0',
      convertScriptVersion: '2.0.4-ts',
    }),
  );
  fs.writeFileSync(path.join(dir, 'application.js'), '// app\n');
  fs.writeFileSync(
    path.join(dir, 'check-version.js'),
    [
      'const miniProgram = wx.getAccountInfoSync().miniProgram;',
      'exports.isDevelop = miniProgram?.envVersion === "develop";',
    ].join('\n'),
  );
  fs.writeFileSync(
    path.join(dir, 'game.js'),
    [
      "require('./application.js');",
      "if (!GameGlobal.oldFetch) { throw new Error('fetch is not defined'); }",
      'var sysInfo = wx.getSystemInfoSync();',
      "if (sysInfo.platform.toLocaleLowerCase() === 'android') {",
      '  GameGlobal.requestAnimationFrame(__initApp);',
      '} else {',
      '  __initApp();',
      '}',
    ].join('\n'),
  );
  const resourcesDir = path.join(dir, 'assets', 'resources', 'import');
  fs.mkdirSync(resourcesDir, { recursive: true });
  fs.writeFileSync(path.join(resourcesDir, 'ads-config.json'), JSON.stringify([
    1, 0, 0, [], [], [[0, 'ads.config', {
      schemaVersion: 2, enabled: false, environment: 'disabled', policyVersion: 2,
      rewardedAdUnitId: '', dailyGrantLimit: 1, privacyReviewed: false,
    }]],
  ]));
  fs.writeFileSync(path.join(resourcesDir, 'privacy-policy.json'), JSON.stringify([
    1, 0, 0, [], [], [[0, 'privacy-policy', { version: 2, sections: [] }]],
  ]));
}

describe('release manifest source paths', () => {
  it('preserves UTF-8 paths from Git NUL-delimited output', () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'ceo-manifest-utf8-'));
    try {
      execFileSync('git', ['init', repo], { encoding: 'utf8' });
      const tracked = path.join(repo, '文档.md');
      const untracked = path.join(repo, '新素材.json');
      fs.writeFileSync(tracked, 'before');
      execFileSync('git', ['-C', repo, 'add', '--', '文档.md'], { encoding: 'utf8' });
      fs.writeFileSync(tracked, 'after');
      fs.writeFileSync(untracked, '{}');
      expect(new Set(getDirtyPaths(repo))).toEqual(new Set(['新素材.json', '文档.md']));
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
});

describe('R20 patch-release.cjs', () => {
  it('T01 补丁命中 fetch/init/boot-diag/check-version 标记', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ceo-pipe-'));
    const tapDir = path.join(tmp, 'game');
    makeFakeTapGame(tapDir);
    fs.copyFileSync(path.join(root, 'tools', 'splash', 'splash.jpg'), path.join(tapDir, 'splash.d49ca.jpg'));
    const r = runCjs('tools/patch-release.cjs', [tapDir, 'r-test', '1.0.0']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('PATCH_OK');
    const gameJs = fs.readFileSync(path.join(tapDir, 'game.js'), 'utf8');
    expect(gameJs).toContain('CEO-PATCH:fetch-guard');
    expect(gameJs).toContain('CEO-PATCH:init-once');
    expect(gameJs).toContain('CEO-PATCH:boot-diag');
    expect(gameJs).toContain('__CEO_RELEASE_ID__');
    expect(gameJs).not.toContain("throw new Error('fetch is not defined')");
    expect(fs.existsSync(path.join(tapDir, 'logo.png'))).toBe(true);
    expect(fs.existsSync(path.join(tapDir, 'splash-art.png'))).toBe(true);
    expect(fs.existsSync(path.join(tapDir, 'splash.jpg'))).toBe(false);
    expect(fs.existsSync(path.join(tapDir, 'splash.d49ca.jpg'))).toBe(false);
  });

  it('T02 重复应用幂等（不出现多份诊断）', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ceo-pipe-'));
    const tapDir = path.join(tmp, 'game');
    makeFakeTapGame(tapDir);
    runCjs('tools/patch-release.cjs', [tapDir, 'r-test', '1.0.0']);
    const once = fs.readFileSync(path.join(tapDir, 'game.js'), 'utf8');
    const r2 = runCjs('tools/patch-release.cjs', [tapDir, 'r-test', '1.0.0']);
    expect(r2.code).toBe(0);
    const twice = fs.readFileSync(path.join(tapDir, 'game.js'), 'utf8');
    expect(twice).toBe(once);
    expect((twice.match(/CEO-PATCH:boot-diag/g) || []).length).toBe(1);
  });

  it('T03 锚点消失时补丁失败退出而非静默继续', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ceo-pipe-'));
    const tapDir = path.join(tmp, 'game');
    makeFakeTapGame(tapDir);
    fs.writeFileSync(path.join(tapDir, 'game.js'), '// totally different\n');
    const r = runCjs('tools/patch-release.cjs', [tapDir, 'r-test', '1.0.0']);
    expect(r.code).not.toBe(0);
    expect(r.stdout).toMatch(/PATCH_FAIL/);
  });

  it('重复 required 锚点与不匹配 releaseId 均拒绝', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ceo-pipe-'));
    const tapDir = path.join(tmp, 'game');
    makeFakeTapGame(tapDir);
    expect(runCjs('tools/patch-release.cjs', [tapDir, 'r-one', '1.0.0']).code).toBe(0);
    const mismatch = runCjs('tools/patch-release.cjs', [tapDir, 'r-two', '1.0.0']);
    expect(mismatch.code).not.toBe(0);
    expect(mismatch.stdout).toContain('PATCH_FAIL');
  });
});

describe('R20 repack + R21 verify', () => {
  it('打包后校验通过；重复 zip 拒绝覆盖；分隔符为 /', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ceo-zip-'));
    const tapDir = path.join(tmp, 'game');
    makeFakeTapGame(tapDir);
    expect(runCjs('tools/patch-release.cjs', [tapDir, 'r-zip', '1.0.0']).code).toBe(0);
    const zip1 = path.join(tmp, 'a', 'game.zip');
    expect(runCjs('tools/repack-release.cjs', [tapDir, zip1]).code).toBe(0);
    const outDir = path.join(tmp, 'out');
    const verify = runCjs('tools/verify-package.cjs', [zip1, 'r-zip', '1.0.0', outDir]);
    expect(verify.stdout).toContain('VERIFY_OK');
    const manifest = JSON.parse(fs.readFileSync(path.join(outDir, 'manifest.json'), 'utf8'));
    expect(manifest.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(manifest.sizeBytes).toBeLessThan(20 * 1024 * 1024);
    expect(manifest.findings.forbidden).toEqual([]);
    expect(manifest.findings.missing).toEqual([]);
    const zipEntries = readZipFile(zip1);
    expect(zipEntries.every((e) => !e.entryName.includes('\\'))).toBe(true);
    expect(zipEntries.some((e) => e.entryName === 'splash-art.png')).toBe(true);
    expect(zipEntries.some((e) => e.entryName === 'splash.jpg')).toBe(false);
    expect(runCjs('tools/repack-release.cjs', [tapDir, zip1]).code).not.toBe(0);

    const corrupt = Buffer.from(fs.readFileSync(zip1));
    let localOffset = 0;
    let payloadOffset = -1;
    while ((localOffset = corrupt.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), localOffset)) >= 0) {
      const nameLength = corrupt.readUInt16LE(localOffset + 26);
      const extraLength = corrupt.readUInt16LE(localOffset + 28);
      const name = corrupt.slice(localOffset + 30, localOffset + 30 + nameLength).toString('utf8');
      if (name === 'application.js') {
        payloadOffset = localOffset + 30 + nameLength + extraLength;
        break;
      }
      localOffset += 4;
    }
    expect(payloadOffset).toBeGreaterThan(0);
    corrupt[payloadOffset] ^= 0x01;
    expect(() => readZipFileFromBuffer(corrupt)).toThrow();
  });

  it('拒绝改名成哈希 JPG 的烘焙进度启动稿', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ceo-zip-baked-splash-'));
    const tapDir = path.join(tmp, 'game');
    makeFakeTapGame(tapDir);
    expect(runCjs('tools/patch-release.cjs', [tapDir, 'r-baked', '1.0.0']).code).toBe(0);
    fs.copyFileSync(path.join(root, 'tools', 'splash', 'splash.jpg'), path.join(tapDir, 'splash.d49ca.jpg'));
    const zip = path.join(tmp, 'game.zip');
    expect(runCjs('tools/repack-release.cjs', [tapDir, zip]).code).toBe(0);
    const verify = runCjs('tools/verify-package.cjs', [zip, 'r-baked', '1.0.0', path.join(tmp, 'out')]);
    expect(verify.code).not.toBe(0);
    expect(verify.stdout).toContain('baked-progress splash artwork');
  });

  it('按 game.js 解析 Creator 哈希应用入口，不假定 application.js 固定名', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ceo-zip-hashed-app-'));
    const tapDir = path.join(tmp, 'game');
    makeFakeTapGame(tapDir);
    fs.renameSync(path.join(tapDir, 'application.js'), path.join(tapDir, 'application.a4e34.js'));
    const gameJsPath = path.join(tapDir, 'game.js');
    fs.writeFileSync(
      gameJsPath,
      fs.readFileSync(gameJsPath, 'utf8').replace(
        "require('./application.js');",
        "System[\"import\"]('./application.a4e34.js');",
      ),
    );
    expect(runCjs('tools/patch-release.cjs', [tapDir, 'r-hashed', '1.0.0']).code).toBe(0);
    const zip = path.join(tmp, 'game.zip');
    expect(runCjs('tools/repack-release.cjs', [tapDir, zip]).code).toBe(0);
    const outDir = path.join(tmp, 'out');
    const verify = runCjs('tools/verify-package.cjs', [zip, 'r-hashed', '1.0.0', outDir]);
    expect(verify.code).toBe(0);
    const manifest = JSON.parse(fs.readFileSync(path.join(outDir, 'manifest.json'), 'utf8'));
    expect(manifest.applicationEntry).toBe('application.a4e34.js');
    expect(manifest.findings.missing).toEqual([]);
    expect(manifest.findings.missingResourceReferences).toEqual([]);
    expect(manifest.findings.adsEnvironment).toBe('disabled');
    expect(manifest.findings.policyVersion).toBe(2);
  });

  it('从ZIP内的Cocos JsonAsset拒绝广告与隐私版本不一致', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ceo-zip-policy-mismatch-'));
    const tapDir = path.join(tmp, 'game');
    makeFakeTapGame(tapDir);
    const adsPath = path.join(tapDir, 'assets', 'resources', 'import', 'ads-config.json');
    const ads = JSON.parse(fs.readFileSync(adsPath, 'utf8'));
    ads[5][0][2].policyVersion = 1;
    fs.writeFileSync(adsPath, JSON.stringify(ads));
    expect(runCjs('tools/patch-release.cjs', [tapDir, 'r-policy-mismatch', '1.0.0']).code).toBe(0);
    const zip = path.join(tmp, 'game.zip');
    expect(runCjs('tools/repack-release.cjs', [tapDir, zip]).code).toBe(0);
    const verify = runCjs('tools/verify-package.cjs', [zip, 'r-policy-mismatch', '1.0.0', path.join(tmp, 'out')]);
    expect(verify.code).not.toBe(0);
    expect(verify.stdout).toContain('policyVersion differs from packaged privacy policy');
  });

  it('拒绝启用但没有真实广告位ID的ZIP配置', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ceo-zip-empty-ad-id-'));
    const tapDir = path.join(tmp, 'game');
    makeFakeTapGame(tapDir);
    const adsPath = path.join(tapDir, 'assets', 'resources', 'import', 'ads-config.json');
    const ads = JSON.parse(fs.readFileSync(adsPath, 'utf8'));
    ads[5][0][2] = { ...ads[5][0][2], enabled: true, environment: 'test', privacyReviewed: true };
    fs.writeFileSync(adsPath, JSON.stringify(ads));
    expect(runCjs('tools/patch-release.cjs', [tapDir, 'r-empty-ad-id', '1.0.0']).code).toBe(0);
    const zip = path.join(tmp, 'game.zip');
    expect(runCjs('tools/repack-release.cjs', [tapDir, zip]).code).toBe(0);
    const verify = runCjs('tools/verify-package.cjs', [zip, 'r-empty-ad-id', '1.0.0', path.join(tmp, 'out')]);
    expect(verify.code).not.toBe(0);
    expect(verify.stdout).toContain('enabled ads require a non-empty real adUnitId');
  });

  it('拒绝任意嵌套脚本中的 EditorMockPlatform', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ceo-zip-mock-module-'));
    const tapDir = path.join(tmp, 'game');
    makeFakeTapGame(tapDir);
    fs.mkdirSync(path.join(tapDir, 'assets', 'main'), { recursive: true });
    fs.writeFileSync(path.join(tapDir, 'assets', 'main', 'index.hash.js'), 'class EditorMockPlatform {}');
    expect(runCjs('tools/patch-release.cjs', [tapDir, 'r-mock-module', '1.0.0']).code).toBe(0);
    const zip = path.join(tmp, 'game.zip');
    expect(runCjs('tools/repack-release.cjs', [tapDir, zip]).code).toBe(0);
    const verify = runCjs('tools/verify-package.cjs', [zip, 'r-mock-module', '1.0.0', path.join(tmp, 'out')]);
    expect(verify.code).not.toBe(0);
    expect(verify.stdout).toContain('EditorMockPlatform in package');
  });

  it('校验拒绝版本不符/未打补丁的包', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ceo-zip2-'));
    const tapDir = path.join(tmp, 'game');
    makeFakeTapGame(tapDir);
    const zip = path.join(tmp, 'game.zip');
    expect(runCjs('tools/repack-release.cjs', [tapDir, zip]).code).toBe(0);
    const r = runCjs('tools/verify-package.cjs', [zip, 'r-bad', '9.9.9', path.join(tmp, 'out')]);
    expect(r.code).not.toBe(0);
    expect(r.stdout).toMatch(/VERIFY_FAIL/);
  });

  it('校验拒绝生产包里的开发写状态入口', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ceo-zip-hook-'));
    const tapDir = path.join(tmp, 'game');
    makeFakeTapGame(tapDir);
    expect(runCjs('tools/patch-release.cjs', [tapDir, 'r-hook', '1.0.0']).code).toBe(0);
    fs.appendFileSync(path.join(tapDir, 'application.js'), '\nwindow.__CEO_TEST_WRITE__ = true;');
    const zip = path.join(tmp, 'game.zip');
    expect(runCjs('tools/repack-release.cjs', [tapDir, zip]).code).toBe(0);
    const check = runCjs('tools/verify-package.cjs', [zip, 'r-hook', '1.0.0', path.join(tmp, 'out')]);
    expect(check.code).not.toBe(0);
    expect(check.stdout).toMatch(/development test hook/);
  });
});

function readZipFileFromBuffer(buffer) {
  return require(path.join(root, 'tools', 'lib', 'read-zip.cjs')).readZipEntries(buffer);
}
