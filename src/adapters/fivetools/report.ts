// What an import did: counts, skipped data and warnings. Shown on the import screen and kept
// with the source registry (plan §6.1 step 10).

import type { EntityKind } from '../../schema/index.ts';

export type WarningCode =
  | 'fileMissing'
  | 'fileInvalid'
  | 'copyMissing'
  | 'copyCycle'
  | 'modFailed'
  | 'modUnsupported'
  | 'versionFailed'
  | 'subraceOrphan'
  | 'convertFailed'
  | 'duplicateId'
  | 'tableKeyCollision'
  | 'unknownShape';

export interface ImportWarning {
  code: WarningCode;
  message: string;
  /** `name|source` of the record involved, when there is one. */
  entity?: string;
}

export interface ImportReport {
  /** 5etools version, when it could be found. */
  dataVersion?: string;
  filesRead: number;
  counts: Partial<Record<EntityKind, number>>;
  /** 5etools record types present in the files but not imported, with counts. */
  ignored: Record<string, number>;
  warnings: ImportWarning[];
}

export class ReportBuilder {
  readonly report: ImportReport = { filesRead: 0, counts: {}, ignored: {}, warnings: [] };

  warn(code: WarningCode, message: string, entity?: { name?: unknown; source?: unknown }): void {
    const w: ImportWarning = { code, message };
    if (entity && (typeof entity.name === 'string' || typeof entity.source === 'string')) {
      w.entity = `${String(entity.name ?? '?')}|${String(entity.source ?? '?')}`;
    }
    this.report.warnings.push(w);
  }

  ignore(prop: string, count: number): void {
    this.report.ignored[prop] = (this.report.ignored[prop] ?? 0) + count;
  }
}
