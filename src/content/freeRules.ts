// Loading the free rules the app ships (plan 9.3–9.4).

import { runImport } from '../adapters/importClient.ts';
import { SRD_PACK_PATH } from '../adapters/srdPack.ts';
import { ADAPTER_VERSION } from '../adapters/version.ts';
import { repos } from '../db/repos.ts';
import { SRD_BUNDLED, SRD_SOURCE } from './srd.ts';

const url = () => `${import.meta.env.BASE_URL}${SRD_PACK_PATH}`;

/**
 * Loads the free rules when nothing is imported yet (first run), and again when this version
 * of the app converts them differently from the stored copy. Someone who removed them while
 * keeping other content doesn't get them back unasked. True when it loaded them.
 */
export async function ensureFreeRules(): Promise<boolean> {
  if (!SRD_BUNDLED) return false;
  const sources = await repos().content.listSources();
  const srd = sources.find((s) => s.code === SRD_SOURCE);
  if (srd ? srd.adapterVersion >= ADAPTER_VERSION : sources.length > 0) return false;
  await runImport({ kind: 'srd', url: url() });
  return true;
}

/**
 * After content is removed: the free rules' entries a removed book was holding come back
 * (plan 9.4). Only when the free rules are there to begin with.
 */
export async function restoreFreeRules(): Promise<void> {
  if (!SRD_BUNDLED) return;
  const sources = await repos().content.listSources();
  if (!sources.some((s) => s.code === SRD_SOURCE)) return;
  await runImport({ kind: 'srd', url: url() });
}
