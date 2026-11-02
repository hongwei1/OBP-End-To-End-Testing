import type { BrowserContext, Response } from '@playwright/test';
import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

// Successful mutations may change existing objects; this file is never input to
// automatic cleanup. Failed requests and unavailable IDs are recorded too.
export function observeMutations(context: BrowserContext): () => Promise<void> {
  const pending = new Set<Promise<void>>();
  const errors: unknown[] = [];
  async function record(response: Response) {
    const method = response.request().method();
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return;
    const ids: Record<string, string> = {};
    try {
      const body = await response.json();
      for (const key of ['user_id', 'bank_id', 'account_id', 'consent_id', 'entitlement_id', 'dynamic_entity_id']) {
        if (typeof body?.[key] === 'string') ids[key] = body[key];
      }
    } catch { /* HTML and empty mutation responses have no captured identifiers. */ }
    const directory = process.env.ARTIFACT_DIR || path.resolve('test-results');
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const event = { time: new Date().toISOString(), method, path: new URL(response.url()).pathname,
                    status: response.status(), ids, cleanup: 'not_verified; disposable environment required' };
    appendFileSync(path.join(directory, 'mutation-ledger.jsonl'), JSON.stringify(event) + '\n', { mode: 0o600 });
  }
  context.on('response', response => {
    const task = record(response).catch(error => { errors.push(error); });
    pending.add(task);
    void task.finally(() => pending.delete(task));
  });
  return async () => {
    while (pending.size) await Promise.all([...pending]);
    if (errors.length) throw new Error('Mutation ledger could not be written');
  };
}
