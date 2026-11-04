const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
};
const root = path.resolve(__dirname, '../..');
const service = require(path.join(root, 'assets/core/application/AdRewardService.ts'));
const { TapRewardedAdProvider } = require(path.join(root, 'assets/core/platform/TapRewardedAdProvider.ts'));
async function main() {
  const state = { runId: 'probe' };
  const queryMutatesLegacyState = !Object.hasOwn(state, 'adRewards') && (service.canRequestAdCoupon(state, Date.now()), Object.hasOwn(state, 'adRewards'));
  const d1 = new Date(2026, 10, 3, 12).getTime();
  const d2 = new Date(2026, 10, 4, 12).getTime();
  service.beginAdSession(state, 'first', d1);
  service.grantAdCoupon(state, 'first', d1);
  service.consumeAdCoupon(state, 'first');
  service.beginAdSession(state, 'second', d2);
  service.grantAdCoupon(state, 'second', d2);
  service.consumeAdCoupon(state, 'second');
  const rollbackAllowsThirdClaim = service.beginAdSession(state, 'rollback', d1) && service.grantAdCoupon(state, 'rollback', d1);
  let close;
  let showCalls = 0;
  const ad = {
    onClose(fn) { close = fn; }, offClose() {}, onError() {}, offError() {},
    show() { showCalls++; return Promise.reject(new Error('material-not-loaded')); },
  };
  const provider = new TapRewardedAdProvider(true, 'probe-unit-only-in-evidence', { tap: { createRewardedVideoAd() { return ad; } } });
  const first = await provider.show('load-not-ready');
  const availableAfterRejectedShow = provider.isAvailable();
  close({ isEnded: false });
  const result = { queryMutatesLegacyState, rollbackAllowsThirdClaim, provider: { first, showCalls, availableAfterRejectedShow, recoversAfterTerminalClose: provider.isAvailable() }, caveat: 'Source-level Node probe; no Tap SDK, live ad, browser, or device verification.' };
  fs.writeFileSync(path.join(__dirname, 'ad-source-probe.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
