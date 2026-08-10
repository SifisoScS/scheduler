'use strict';

/**
 * Guards against a platform-pruned package-lock.json.
 *
 * A bare `npm install` resolves optional dependencies against the current
 * machine only and rewrites the lockfile without the native bindings for other
 * platforms. Jest 30 pulls in such bindings via jest-resolve, so committing a
 * lockfile produced that way breaks `npm ci` for everyone on a different OS.
 *
 * Two independent checks, because pruning shows up in two different ways:
 *
 *   1. Platform coverage — packages carrying an `os` constraint must still
 *      cover every platform we build on.
 *   2. Dependency completeness — every dependency named by an entry must
 *      resolve to another entry. Pruning also removes transitive packages that
 *      carry no platform metadata of their own, which check 1 cannot see. This
 *      is the invariant `npm ci` enforces, verified before install rather than
 *      after a push.
 *
 * Neither check hardcodes a package name, so both keep working as the
 * dependency tree changes. A tree with no platform-scoped packages passes
 * rather than false-alarming.
 *
 * Usage:
 *   node scripts/check-lockfile.js [path-to-package-lock.json]
 */

const fs = require('node:fs');
const path = require('node:path');

const REQUIRED_PLATFORMS = ['linux', 'darwin', 'win32'];

const target = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(__dirname, '..', 'package-lock.json');

if (!fs.existsSync(target)) {
  console.error(`check-lockfile: no lockfile at ${target}`);
  process.exit(1);
}

let lock;
try {
  lock = JSON.parse(fs.readFileSync(target, 'utf8'));
} catch (error) {
  console.error(`check-lockfile: ${target} is not valid JSON — ${error.message}`);
  process.exit(1);
}

const packages = lock.packages ?? {};
const paths = new Set(Object.keys(packages));

const problems = [];

// --- 1. Platform coverage -------------------------------------------------
// Native bindings carry an `os` constraint. If whole platforms have vanished,
// the lockfile was rewritten against one machine.

const scoped = Object.entries(packages).filter(([, meta]) => Array.isArray(meta.os));
const platforms = new Set(scoped.flatMap(([, meta]) => meta.os));

if (scoped.length > 0) {
  const absent = REQUIRED_PLATFORMS.filter((platform) => !platforms.has(platform));
  if (absent.length > 0) {
    problems.push(
      `missing platforms: ${absent.join(', ')} (present: ${[...platforms].sort().join(', ')})`,
    );
  }
}

// --- 2. Dependency completeness -------------------------------------------
// Pruning also drops transitive dependencies that carry no `os` field of their
// own, which the check above cannot see. Every dependency named by an entry
// must resolve to another entry, walking up node_modules the way Node does.
// This is the same invariant `npm ci` enforces, checked before install.

function resolve(fromPath, name) {
  let prefix = fromPath;
  for (;;) {
    const candidate = prefix ? `${prefix}/node_modules/${name}` : `node_modules/${name}`;
    if (paths.has(candidate)) return true;
    if (!prefix) return false;
    const cut = prefix.lastIndexOf('/node_modules/');
    prefix = cut === -1 ? '' : prefix.slice(0, cut);
  }
}

const unresolved = [];
for (const [entryPath, meta] of Object.entries(packages)) {
  const named = { ...(meta.dependencies ?? {}), ...(meta.optionalDependencies ?? {}) };
  for (const name of Object.keys(named)) {
    if (!resolve(entryPath, name)) {
      unresolved.push(`${name} (required by ${entryPath || 'the root project'})`);
    }
  }
}

if (unresolved.length > 0) {
  const shown = unresolved.slice(0, 8);
  problems.push(
    `unresolved dependencies:\n      ${shown.join('\n      ')}` +
      (unresolved.length > shown.length
        ? `\n      …and ${unresolved.length - shown.length} more`
        : ''),
  );
}

// --- Report ---------------------------------------------------------------

if (problems.length > 0) {
  console.error(
    [
      '',
      'check-lockfile: package-lock.json is incomplete.',
      '',
      ...problems.map((problem) => `  - ${problem}`),
      '',
      'This happens when npm rewrites the lockfile against the current machine,',
      'dropping packages other platforms need. `npm ci` will then fail everywhere',
      'else. On Windows this cannot be repaired locally: even',
      '`npm install --package-lock-only` prunes.',
      '',
      'To fix:',
      '  git checkout -- package-lock.json   # discard the rewritten lockfile',
      '  npm ci                              # install without rewriting it',
      '',
      'If you genuinely need to add or remove a dependency, let Dependabot do it,',
      'or regenerate the lockfile on Linux.',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

const coverage =
  scoped.length > 0
    ? `${scoped.length} platform-scoped package(s) covering ${[...platforms].sort().join(', ')}`
    : 'no platform-scoped packages';

console.log(`check-lockfile: ok — ${coverage}; ${paths.size} entries all resolve.`);
