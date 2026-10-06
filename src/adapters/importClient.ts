// Main-thread side of imports: sends a job to the import worker and reports progress. Without
// Worker support (tests) the job runs in-thread against the app database.

import { repos } from '../db/repos.ts';
import type { ImportJob, ImportSummary, JobStage } from './importJob.ts';

export type WorkerRequest = { id: number; job: ImportJob };

export type WorkerResponse =
  | { id: number; type: 'progress'; stage: JobStage }
  | { id: number; type: 'done'; summary: ImportSummary }
  | { id: number; type: 'error'; message: string };

let nextId = 1;

export function runImport(
  job: ImportJob,
  onProgress: (stage: JobStage) => void = () => {},
): Promise<ImportSummary> {
  if (typeof Worker === 'undefined') {
    // The importer stays out of the main bundle; it is only loaded here when there is no worker.
    return import('./importJob.ts').then(({ runImportJob }) =>
      runImportJob(job, repos(), onProgress),
    );
  }

  const worker = new Worker(new URL('./importWorker.ts', import.meta.url), { type: 'module' });
  const id = nextId++;
  return new Promise<ImportSummary>((resolve, reject) => {
    worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      if (msg.id !== id) return;
      if (msg.type === 'progress') return onProgress(msg.stage);
      worker.terminate();
      if (msg.type === 'done') resolve(msg.summary);
      else reject(new Error(msg.message));
    });
    worker.addEventListener('error', (event) => {
      worker.terminate();
      reject(new Error(event.message || 'The import stopped unexpectedly.'));
    });
    worker.postMessage({ id, job } satisfies WorkerRequest);
  });
}
