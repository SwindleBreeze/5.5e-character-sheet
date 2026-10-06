// Web Worker that runs imports off the main thread (plan §2). It writes to the same IndexedDB
// database as the app; open screens pick up the change through Dexie live queries.

import { createContentRepo } from '../db/contentRepo.ts';
import { AppDb } from '../db/db.ts';
import { createSettingsRepo } from '../db/settingsRepo.ts';
import { runImportJob } from './importJob.ts';
import type { WorkerRequest, WorkerResponse } from './importClient.ts';

const db = new AppDb();
const deps = { content: createContentRepo(db), settings: createSettingsRepo(db) };

function post(message: WorkerResponse) {
  globalThis.postMessage(message);
}

globalThis.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const { id, job } = event.data;
  runImportJob(job, deps, (stage) => post({ id, type: 'progress', stage }))
    .then((summary) => post({ id, type: 'done', summary }))
    .catch((err: unknown) =>
      post({ id, type: 'error', message: err instanceof Error ? err.message : String(err) }),
    );
});
