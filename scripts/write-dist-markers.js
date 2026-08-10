'use strict';

/**
 * Writes the per-directory `type` markers the dual build depends on.
 *
 * The root package is `"type": "commonjs"`, so Node reads every .js file under
 * dist/ as CommonJS unless a nearer package.json says otherwise. Dropping a
 * minimal package.json into each output directory tells Node how to parse that
 * subtree, which is what lets one package ship both formats with plain .js
 * extensions.
 */

const fs = require('node:fs');
const path = require('node:path');

const dist = path.join(__dirname, '..', 'dist');

const markers = [
  ['cjs', 'commonjs'],
  ['esm', 'module'],
];

for (const [dir, type] of markers) {
  const target = path.join(dist, dir);

  if (!fs.existsSync(target)) {
    console.error(`write-dist-markers: ${target} does not exist — run the build first.`);
    process.exit(1);
  }

  fs.writeFileSync(path.join(target, 'package.json'), `${JSON.stringify({ type }, null, 2)}\n`);
  console.log(`write-dist-markers: dist/${dir}/package.json -> { "type": "${type}" }`);
}
