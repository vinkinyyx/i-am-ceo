const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const root = path.resolve(__dirname, '../..');
const svc = require(path.join(root, 'assets/core/application/AdRewardService.ts'));
const { createInitialState } = require(path.join(root, 'assets/core/domain/gameStateFactory.ts'));
function fresh() { const state = createInitialState(Date.parse('2026-11-03T04:00:00Z'), 482); state.phase = 'RUNNING'; state.onboarding.initialHiresCompleted = 2; return state; }
async function main() {
  const cross = fresh();
  svc.beginAdSession(cross, 'cross', Date.parse('2026-11-03T15:59:00Z'));
  svc.grantAdCoupon(cross, 'cross', Date.parse('2026-11-03T16:01:00Z'));
  svc.consumeAdCoupon(cross, 'cross', Date.parse('2026-11-03T16:01:01Z'));
  const afterMidnightAvailable = svc.canRequestAdCoupon(cross, Date.parse('2026-11-03T16:04:00Z'));
  const legacy = fresh();
  legacy.adRewards = { localDay: '2026-11-03', promptsShown: 0, grantsUsed: 1, couponIds: ['legacy'], completedSessionIds: ['legacy'] };
  svc.markAdPromptShown(legacy, Date.parse('2026-11-04T04:00:00Z'));
  const legacyAfterOneYear = svc.isAdCouponAvailable(legacy, 'legacy', Date.parse('2027-11-04T04:00:00Z'));
  const ttl = fresh();
  svc.beginAdSession(ttl, 'ttl', Date.parse('2026-11-03T04:00:00Z'));
  svc.grantAdCoupon(ttl, 'ttl', Date.parse('2026-11-03T04:00:00Z'));
  const stillValidAfterDesignedExpiry = svc.isAdCouponAvailable(ttl, 'ttl', Date.parse('2026-11-09T16:01:00Z'));
  const many = fresh();
  const start = Date.parse('2026-11-03T04:00:00Z');
  for (let i = 0; i < 40; i++) {
    const now = start + i * 86_400_000;
    if (!svc.beginAdSession(many, `day-${i}`, now) || !svc.grantAdCoupon(many, `day-${i}`, now)) throw new Error(`unexpected probe setup failure ${i}`);
    svc.consumeAdCoupon(many, `day-${i}`, now);
  }
  const appPath = path.join(root, 'assets/scripts/ui/AppView.ts');
  const source = fs.readFileSync(appPath, 'utf8');
  const ast = ts.createSourceFile(appPath, source, ts.ScriptTarget.Latest, true);
  let appClass;
  ast.forEachChild(node => { if (ts.isClassDeclaration(node) && node.name?.text === 'AppView') appClass = node; });
  const methods = ['clockTick', 'requestAdCoupon'].map(name => appClass.members.find(node => node.name?.getText(ast) === name).getText(ast));
  const compiled = ts.transpileModule(`class Probe { ${methods.join('\n')} } module.exports = Probe;`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const extractedFilename = path.join(__dirname, 'extracted-app.cjs');
  const holder = new Module(extractedFilename);
  holder._compile(compiled, extractedFilename);
  const Probe = holder.exports;
  let advancedDuringAd = 0;
  const clock = new Probe();
  Object.assign(clock, { facade: { getPersistenceStatus: () => 'ready', getState: () => ({ phase: 'RUNNING', speed: 1, runId: 'probe' }), advanceRealTime: async () => { advancedDuringAd++; return { ok: true, payload: { monthsAdvanced: 0, yearsClosed: [] } }; } }, adCoordinator: { hasActiveSession: () => true }, tickAdEligibility() {}, lastFrameMs: Date.now() - 1000, fgClock: { noteOnlineProgress() {} } });
  clock.clockTick();
  await new Promise(resolve => setImmediate(resolve));
  let requestedBeforeSixtySeconds = 0;
  const entry = new Probe();
  Object.assign(entry, { adForegroundEligibleSinceMs: Date.now(), adCoordinator: { request: async () => { requestedBeforeSixtySeconds++; return { kind: 'skipped' }; } }, toast() {} });
  await entry.requestAdCoupon();
  const result = { scope: 'Pure domain probe plus extracted actual AppView method harness; no real SDK/device/browser ad.', crossMidnight: { expectedNextDayRequestAvailable: true, actual: afterMidnightAvailable }, legacyCoupon: { validAfterOneYear: legacyAfterOneYear, stableCreatedTimestampRecorded: legacy.adRewards.couponCreatedAtMsById?.legacy !== undefined }, sevenNaturalDays: { expectedValidAtNov10_0001China: false, actual: stillValidAfterDesignedExpiry }, metadataRetention: { issuedAndUsed: 40, createdEntries: Object.keys(many.adRewards.couponCreatedAtMsById).length, runEntries: Object.keys(many.adRewards.couponRunIdById).length, completedSessionEntries: many.adRewards.completedSessionIds.length }, actualAppMethods: { advanceRealTimeCallsWithActiveAd: advancedDuringAd, coordinatorRequestsBeforeSixtySeconds: requestedBeforeSixtySeconds } };
  fs.writeFileSync(path.join(__dirname, 'ad-review-probe.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
