#!/usr/bin/env node
// Fails if any tracked (or about-to-be-tracked) file looks like game content.
// Usage: npm run content-guard

import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { findViolations } from './content-guard-core.mjs';

// Tracked files plus untracked files that .gitignore does not exclude.
const files = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  {
    encoding: 'utf8',
  },
)
  .split('\0')
  .filter(Boolean)
  .filter((path) => {
    try {
      return statSync(path).isFile();
    } catch {
      return false; // Deleted in the working tree.
    }
  });

const violations = findViolations(
  files,
  (path) => readFileSync(path, 'utf8'),
  (path) => statSync(path).size,
);

if (violations.length > 0) {
  console.error('Content guard failed. These files must not be committed:\n');
  for (const v of violations) console.error(`  ${v.path}: ${v.reason}`);
  process.exit(1);
}

console.log(`Content guard passed (${files.length} files checked).`);
