const { execFileSync } = require('node:child_process');

function getDirtyPaths(repoRoot) {
  const raw = execFileSync('git', [
    '-C', repoRoot,
    'ls-files', '-z', '-m', '-o', '--exclude-standard',
  ]);
  return raw.toString('utf8').split('\0').filter(Boolean);
}

module.exports = { getDirtyPaths };
