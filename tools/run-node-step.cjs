#!/usr/bin/env node
// Capture tool stdout/stderr separately so PowerShell does not treat diagnostics as terminating errors.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const [stdoutPath, stderrPath, resultPath, script, ...args] = process.argv.slice(2);
if (![stdoutPath, stderrPath, resultPath, script].every(Boolean)) {
  console.error('Usage: run-node-step.cjs <stdoutLog> <stderrLog> <resultJson> <script> [...args]');
  process.exit(2);
}

async function run() {
  const startedAt = new Date().toISOString();
  await Promise.all([stdoutPath, stderrPath, resultPath].map((file) => fs.promises.mkdir(path.dirname(file), { recursive: true })));
  const child = spawn(process.execPath, [script, ...args], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let stdout = '';
  let stderr = '';
  let spawnError = null;
  child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
  child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
  child.on('error', (error) => { spawnError = error.message; });
  const exitCode = await new Promise((resolve) => child.on('close', resolve));
  await Promise.all([
    fs.promises.writeFile(stdoutPath, stdout, 'utf8'),
    fs.promises.writeFile(stderrPath, stderr, 'utf8'),
  ]);
  const result = { script, args, startedAt, finishedAt: new Date().toISOString(), exitCode, spawnError, stdoutPath, stderrPath };
  await fs.promises.writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(result));
  if (spawnError || exitCode !== 0) process.exitCode = 1;
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
