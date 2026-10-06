// Content guard: the repo must never contain game content (plan §3, task 1.8).
// Pure logic, used by scripts/content-guard.mjs and its tests.

/** Paths that must never be tracked. */
const FORBIDDEN_PATHS = [
  { re: /(^|\/)data\//, why: 'data/ folders are reserved for imported content' },
  { re: /\.pack\.json(\.gz)?$/i, why: 'pack files hold game content' },
  { re: /(^|\/)5etools[^/]*\//i, why: '5etools sources must stay outside the repo' },
  { re: /\.zip$/i, why: 'archives may contain game content' },
];

/** Top-level keys that mark a 5etools data file (or a pack). */
const CONTENT_KEYS = new Set([
  'spell',
  'class',
  'classFeature',
  'subclass',
  'subclassFeature',
  'background',
  'feat',
  'race',
  'subrace',
  'item',
  'baseitem',
  'magicvariant',
  'optionalfeature',
  'condition',
  'disease',
  'status',
  'variantrule',
  'action',
  'monster',
  'language',
  'skill',
  'sense',
  'itemProperty',
  'itemMastery',
  'entities',
]);

/** Folder for hand-written test fixtures; each JSON file there must declare itself. */
export const FIXTURE_DIR = 'tests/fixtures/';
export const FIXTURE_MARKER = '_fixture';
export const FIXTURE_MAX_BYTES = 50_000;
export const FILE_MAX_BYTES = 1_000_000;

const SIZE_EXEMPT = new Set(['package-lock.json']);

/**
 * @param {string[]} files repo-relative paths with forward slashes
 * @param {(path: string) => string} readText
 * @param {(path: string) => number} sizeOf
 * @returns {{ path: string, reason: string }[]}
 */
export function findViolations(files, readText, sizeOf) {
  const violations = [];
  for (const path of files) {
    const pathRule = FORBIDDEN_PATHS.find((rule) => rule.re.test(path));
    if (pathRule) {
      violations.push({ path, reason: pathRule.why });
      continue;
    }

    const size = sizeOf(path);
    const isFixture = path.startsWith(FIXTURE_DIR);
    if (!SIZE_EXEMPT.has(path) && size > FILE_MAX_BYTES) {
      violations.push({ path, reason: `file is larger than ${FILE_MAX_BYTES} bytes` });
    }

    if (!path.endsWith('.json') || SIZE_EXEMPT.has(path)) continue;

    let json;
    try {
      json = JSON.parse(readText(path));
    } catch {
      continue; // Not our concern; tooling will complain about invalid JSON.
    }
    if (json === null || typeof json !== 'object' || Array.isArray(json)) continue;

    if (json.format === '5e-sheet-pack') {
      violations.push({ path, reason: 'looks like a content pack' });
      continue;
    }

    const contentKeys = Object.keys(json).filter((k) => CONTENT_KEYS.has(k));
    if (contentKeys.length === 0) continue;

    if (!isFixture) {
      violations.push({
        path,
        reason: `looks like game data (top-level keys: ${contentKeys.join(', ')})`,
      });
    } else if (json[FIXTURE_MARKER] !== true) {
      violations.push({
        path,
        reason: `fixture must declare "${FIXTURE_MARKER}": true to confirm it is hand-written`,
      });
    } else if (size > FIXTURE_MAX_BYTES) {
      violations.push({ path, reason: `fixture is larger than ${FIXTURE_MAX_BYTES} bytes` });
    }
  }
  return violations;
}
