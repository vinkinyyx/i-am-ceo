#!/usr/bin/env node
// Spawn the documented Cocos CLI shape, capturing full output and the real exit code.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const [creatorExe, projectRoot, buildOptions, stdoutPath, stderrPath, resultPath] = process.argv.slice(2);
if (creatorExe === '--help' || process.argv.includes('--help')) {
  console.log('Usage: run-cocos-build.cjs <CreatorExe> <projectRoot> <platform=wechatgame|web-mobile;...> <stdoutLog> <stderrLog> <resultJson>');
  process.exit(0);
}
if (![creatorExe, projectRoot, buildOptions, stdoutPath, stderrPath, resultPath].every(Boolean)) {
  console.error('Usage: run-cocos-build.cjs <creatorExe> <projectRoot> <buildOptions> <stdoutLog> <stderrLog> <resultJson>');
  process.exit(2);
}
const platform = /(?:^|;)platform=(wechatgame|web-mobile)(?:;|$)/.exec(buildOptions)?.[1];
if (!platform) {
  console.error('BUILD_FAIL unsupported or missing platform (allowed: wechatgame, web-mobile)');
  process.exit(2);
}

async function run() {
  const startedAt = new Date().toISOString();
  await Promise.all([stdoutPath, stderrPath, resultPath].map((file) => fs.promises.mkdir(path.dirname(file), { recursive: true })));
  const child = spawn(creatorExe, ['--project', projectRoot, '--build', buildOptions], {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
  child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
  let spawnError = null;
  child.on('error', (error) => { spawnError = error.message; });
  const exitCode = await new Promise((resolve) => child.on('close', resolve));
  await Promise.all([
    fs.promises.writeFile(stdoutPath, stdout, 'utf8'),
    fs.promises.writeFile(stderrPath, stderr, 'utf8'),
  ]);
  const doneMarker = stdout.includes(`build Task (${platform}) Finished in`);
  const result = {
    command: creatorExe,
    args: ['--project', projectRoot, '--build', buildOptions],
    platform,
    startedAt,
    finishedAt: new Date().toISOString(),
    exitCode,
    doneMarker,
    spawnError,
    stdoutPath,
    stderrPath,
  };
  await fs.promises.writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(result));
  if (spawnError || (exitCode !== 0 && exitCode !== 36) || !doneMarker) process.exitCode = 1;
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
