#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { getDirtyPaths } = require('./lib/git-dirty-paths.cjs');
const [rootArg, output] = process.argv.slice(2);
if (!rootArg || !output) { console.error('FINGERPRINT_FAIL usage: <root> <output>'); process.exit(2); }
const root = path.resolve(rootArg);
const include = /^(assets|tools|extensions|settings|build-templates|project\.json|package(?:-lock)?\.json|tsconfig(?:\.ui|\.core)?\.json|AGENT\.md|skills\/taptap-mini-game-publisher\/)/i;
const files = getDirtyPaths(root).filter((p) => include.test(p.replace(/\\/g, '/'))).sort();
const inputs = files.map((relativePath) => {
  const absolute = path.resolve(root, relativePath);
  if (!absolute.startsWith(root + path.sep) || !fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) return { path: relativePath, missing: true };
  return { path: relativePath.replace(/\\/g, '/'), sha256: crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex') };
});
const fingerprint = crypto.createHash('sha256').update(JSON.stringify(inputs)).digest('hex');
fs.writeFileSync(output, `${JSON.stringify({ fingerprint, inputs }, null, 2)}\n`);
console.log('FINGERPRINT', fingerprint, inputs.length);
