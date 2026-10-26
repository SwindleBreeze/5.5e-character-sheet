#!/usr/bin/env node
// Fails if any tracked (or about-to-be-tracked) file looks like game content.
// Usage: npm run content-guard          (the repo)
//        npm run content-guard:dist     (the built site in dist/, plan 9.8)

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ALLOWED_CONTENT, findViolations } from './content-guard-core.mjs';

const dist = process.argv.includes('--dist');

/** Every file under a folder, with forward slashes. */
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name).replaceAll('\\', '/')],
  );
}

const files = dist
  ? walk('dist')
  : // Tracked files plus untracked files that .gitignore does not exclude.
    execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
      encoding: 'utf8',
    })
      .split('\0')
      .filter(Boolean)
      .filter((path) => {
        try {
          return statSync(path).isFile();
        } catch {
          return false; // Deleted in the working tree.
        }
      });

// In the built site, the allowed content sits where `public/` puts it.
const allowed = dist
  ? ALLOWED_CONTENT.map((a) => ({ ...a, path: a.path.replace(/^public\//, 'dist/') }))
  : ALLOWED_CONTENT;

const violations = findViolations(
  files,
  (path) => readFileSync(path, 'utf8'),
  (path) => statSync(path).size,
  {
    allowed,
    hashOf: (path) => createHash('sha256').update(readFileSync(path)).digest('hex'),
    sizes: !dist,
  },
);

if (violations.length > 0) {
  console.error('Content guard failed. These files must not be committed:\n');
  for (const v of violations) console.error(`  ${v.path}: ${v.reason}`);
  process.exit(1);
}

console.log(`Content guard passed (${files.length} files checked${dist ? ' in dist/' : ''}).`);
