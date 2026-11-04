// Add traceability metadata after final ZIP verification; never embeds file contents.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { getDirtyPaths } = require('./lib/git-dirty-paths.cjs');

const [rootArg, logDirArg, releaseId, attempt, purpose, buildExitCode] = process.argv.slice(2);
if (!rootArg || !logDirArg || !releaseId || !attempt || !purpose || !buildExitCode) {
  console.error('MANIFEST_FAIL usage');
  process.exit(2);
}
const root = path.resolve(rootArg);
const logDir = path.resolve(logDirArg);
const manifestPath = path.join(logDir, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error('MANIFEST_FAIL final package manifest missing');
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const creatorResultPath = path.join(logDir, 'creator-result.json');
const creatorResult = fs.existsSync(creatorResultPath) ? JSON.parse(fs.readFileSync(creatorResultPath, 'utf8')) : null;
const inputSnapshotPath = path.join(logDir, 'release-inputs-before.json');
const inputSnapshot = fs.existsSync(inputSnapshotPath) ? JSON.parse(fs.readFileSync(inputSnapshotPath, 'utf8')) : null;
const sha256File = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
const dirtyPaths = getDirtyPaths(root);
const secretPath = /(^|[\\/])(?:\.env(?:\.[^\\/]*)?|[^\\/]*\.(?:pem|p12|key)|secrets?[^\\/]*)$/i;
const dirtySourceSha256 = dirtyPaths
  .filter((relative) => !secretPath.test(relative))
  .map((relative) => {
    const absolute = path.resolve(root, relative);
    if (!absolute.startsWith(root + path.sep) || !fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) return null;
    return { path: relative.replace(/\\/g, '/'), sha256: sha256File(absolute) };
  })
  .filter(Boolean);
const plugin = JSON.parse(fs.readFileSync(path.join(root, 'extensions/taptap-minigame-tools/package.json'), 'utf8'));
const logFiles = fs.readdirSync(logDir).filter((name) => fs.statSync(path.join(logDir, name)).isFile()).sort();
const configPath = path.join(root, 'assets/resources/config/economy.v1.json');
Object.assign(manifest, {
  attempt,
  purpose,
  creatorVersion: '3.8.8',
  tapPluginVersion: plugin.version,
  sourceHead: git('rev-parse', 'HEAD'),
  dirtySourceSha256,
  configSha256: fs.existsSync(configPath) ? sha256File(configPath) : null,
  buildExitCode: buildExitCode === 'not-run' ? null : Number(buildExitCode),
  buildWasExecuted: buildExitCode !== 'not-run',
  buildStartedAt: creatorResult?.startedAt ?? null,
  buildFinishedAt: creatorResult?.finishedAt ?? null,
  verifiedAt: manifest.verifiedAt ?? new Date().toISOString(),
  inputFingerprint: inputSnapshot?.fingerprint ?? null,
  inputFiles: inputSnapshot?.inputs ?? [],
  logFiles,
});
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log('MANIFEST_ENRICHED', releaseId, attempt, dirtySourceSha256.length, 'dirty files hashed');
