#!/usr/bin/env node
/* Fails when an exported Hermes bundle exceeds the budget (7.5 MiB). Reads each dir's metadata.json. */
const fs = require('fs');
const path = require('path');

const MAX_BYTES = 7864320;

function checkBundleSize(distDirs, maxBytes = MAX_BYTES) {
  const sizes = {};
  let ok = true;
  for (const dir of distDirs) {
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(dir, 'metadata.json'), 'utf8'));
      const platforms = Object.entries(meta.fileMetadata || {});
      if (platforms.length === 0) throw new Error('no platforms in metadata.json');
      for (const [platform, info] of platforms) {
        const size = fs.statSync(path.join(dir, info.bundle)).size;
        sizes[`${dir}:${platform}`] = size;
        if (size > maxBytes) ok = false;
      }
    } catch (e) {
      console.error(`check:bundle: cannot read ${dir}: ${e.message}`);
      ok = false;
    }
  }
  return { ok, sizes };
}

module.exports = { checkBundleSize, MAX_BYTES };
if (require.main === module) {
  const dirs = process.argv.slice(2);
  const limit = MAX_BYTES;
  const { ok, sizes } = checkBundleSize(dirs.length ? dirs : ['dist', 'dist-ios'], limit);
  for (const [key, size] of Object.entries(sizes)) {
    const over = size > limit ? ` OVER the ${limit} byte limit` : '';
    console.log(`${key}: ${size} bytes${over}`);
  }
  if (!ok) {
    for (const [key, size] of Object.entries(sizes)) {
      if (size > limit) console.error(`check:bundle: ${key} bundle is over ${limit} bytes`);
    }
    process.exit(1);
  }
}
