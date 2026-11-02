import { EventEmitter } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { BrowserContext } from '@playwright/test';
import { observeMutations } from '../src/helpers/MutationLedger.js';
import { test, expect } from '@playwright/test';
import { MailpitClient } from '../src/helpers/MailpitClient.js';
import { allowedRequest, validateGroup, validateRun } from '../src/config/safety.js';

const login = { OBP_E2E_GROUP: 'login', APIM_URL: 'https://manager.example.com', OIDC_BASE: 'https://oidc.example.com',
                LOGIN_USERNAME: 'synthetic_user', LOGIN_PASSWORD: 'fake-only', LOGIN_PROVIDER: 'https://api.example.com' };

test('group selection, target restrictions and write guards fail closed', () => {
  expect(() => validateRun({})).toThrow('select one group');
  expect(() => validateRun(login)).not.toThrow();
  const keycloak = { ...login, LOGIN_IDP: 'keycloak', KEYCLOAK_BASE: 'https://kc.example.com', KEYCLOAK_REALM: 'test' };
  expect(() => validateRun(keycloak)).not.toThrow();
  expect(() => validateRun({ ...keycloak, KEYCLOAK_REALM: '' })).toThrow('KEYCLOAK_REALM');
  expect(() => validateRun({ ...keycloak, KEYCLOAK_BASE: 'https://ec2admin' })).toThrow('forbidden');
  expect(() => validateRun({ ...login, LOGIN_IDP: 'google' })).toThrow('OBP-OIDC and Keycloak only');
  for (const host of ['ec2admin', '10.0.3.183', '10.0.3.146', '95.128.185.73', 'api.ttk.com.mk']) {
    // Pure URL classification; these hosts are never contacted.
    expect(allowedRequest(`https://${host}`)).toBe(false);
    expect(() => validateRun({ ...login, APIM_URL: `https://${host}` })).toThrow('forbidden');
  }
  // vrp runs remotely, reading its OTP from Mailpit for the test user's own mailbox.
  const vrp = { OBP_E2E_GROUP: 'vrp', HOLA_URL: 'https://hola.example.com', PORTAL_URL: 'https://portal.example.com',
                OIDC_BASE: 'https://oidc.example.com', LOGIN_USERNAME: 'synthetic_user', LOGIN_PASSWORD: 'fake-only',
                LOGIN_PROVIDER: 'https://api.example.com', VRP_FROM_BANK_ROUTING_ADDRESS: 'bank',
                VRP_FROM_ROUTING_ADDRESS: 'from', VRP_TO_ROUTING_ADDRESS: 'to',
                MAILPIT_API_URL: 'http://mailpit.obp.svc.cluster.local:8025',
                OTP_MAILPIT_QUERY: 'to:{LOGIN_USERNAME}@example.org subject:"OBP Consent Challenge"' };
  expect(() => validateRun(vrp)).not.toThrow();
  expect(() => validateRun({ ...vrp, OTP_MAILPIT_QUERY: 'subject:"OBP Consent Challenge"' })).toThrow('run-owned recipient');
  // A disposable-only group is restricted to a disposable environment with loopback endpoints.
  const isolated = { scope: 'isolated', mutation: 'business-write', required: [], cleanup: 'none' };
  expect(() => validateGroup('synthetic', isolated, { HOLA_URL: 'http://localhost:8082' })).toThrow('disposable');
  expect(() => validateGroup('synthetic', isolated, { PORTAL_URL: 'https://sandbox.example.com', OBP_ISOLATED_TEST_ENV: '1',
                                                      OBP_ALLOW_TEST_WRITES: '1' })).toThrow('isolated');
  // rate-limit runs remotely but only with the explicit abuse opt-in.
  const abuse = { OBP_E2E_GROUP: 'rate-limit', PORTAL_URL: 'https://portal.example.com' };
  expect(() => validateRun(abuse)).toThrow('opt-in');
  expect(() => validateRun({ ...abuse, OBP_ALLOW_ABUSE_TESTS: '1' })).not.toThrow();
  // Every guard satisfied, but the group cannot yet remove what it creates.
  const uncleaned = { scope: 'remote', mutation: 'business-write', required: [], cleanup: 'missing' };
  expect(() => validateGroup('synthetic', uncleaned, { PORTAL_URL: 'https://portal.example.com' })).toThrow('no cleanup routine');
  // entitlements reads the in-cluster Mailpit over plain HTTP; no other endpoint may use HTTP on a remote host.
  const ent = { ...login, OBP_E2E_GROUP: 'entitlements', PORTAL_URL: 'https://portal.example.com',
                MAILPIT_API_URL: 'http://mailpit.obp.svc.cluster.local:8025',
                REGISTERED_USER_CREDENTIALS_PROVIDER: 'https://api.example.com', POWERFUL_USER_1_USERNAME: 'synthetic_user',
                POWERFUL_USER_1_PASSWORD: 'fake-only', POWERFUL_USER_1_CREDENTIALS_PROVIDER: 'https://api.example.com' };
  expect(() => validateRun(ent)).not.toThrow();
  expect(() => validateRun({ ...ent, PORTAL_URL: 'http://portal.obp.svc.cluster.local' })).toThrow('insecure');
  // create-bank declares its cleanup and runs remotely as the ordinary test user.
  expect(() => validateRun({ ...login, OBP_E2E_GROUP: 'create-bank', POWERFUL_USER_1_USERNAME: 'synthetic_user',
                             POWERFUL_USER_1_PASSWORD: 'fake-only', POWERFUL_USER_1_CREDENTIALS_PROVIDER: 'https://api.example.com' })).not.toThrow();
});

test('Mailpit retains all messages and advances to the next unseen message', async () => {
  const saved = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input, init) => {
    expect(init?.method || 'GET').toBe('GET');
    const url = String(input); calls.push(url);
    if (url.includes('/search?')) return new Response(JSON.stringify({ total: 2, messages: [{ ID: 'validation' }, { ID: 'reset' }] }));
    return new Response(JSON.stringify({ ID: url.split('/').pop(), Text: 'code 123456' }));
  };
  try {
    const mail = new MailpitClient('http://localhost:8025');
    await mail.deleteAllMessages();
    expect(calls).toHaveLength(0);
    expect((await mail.waitForMessage('to:unique_fixture@example.com')).ID).toBe('validation');
    await mail.deleteAllMessages();
    expect((await mail.waitForMessage('to:unique_fixture@example.com')).ID).toBe('reset');
    const before = calls.length;
    await expect(mail.waitForMessage('subject:any')).rejects.toThrow('run-owned recipient');
    expect(calls).toHaveLength(before);
    expect(mail.extractOtp('Your code is 123456. Repeat 123456.')).toBe('123456');
    expect(() => mail.extractOtp('123456 or 654321')).toThrow('exactly one');
  } finally { globalThis.fetch = saved; }
});

test('Mailpit skips the mail a shared mailbox already holds', async () => {
  const saved = globalThis.fetch;
  const inbox = [{ ID: 'older-run' }];
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('/search?')) return new Response(JSON.stringify({ total: inbox.length, messages: [...inbox] }));
    return new Response(JSON.stringify({ ID: url.split('/').pop(), Text: 'code 123456' }));
  };
  try {
    const mail = new MailpitClient('http://localhost:8025');
    await mail.ignoreExisting('to:tester@example.org');
    inbox.unshift({ ID: 'this-run' });
    expect((await mail.waitForMessage('to:tester@example.org', { pollIntervalMs: 10 })).ID).toBe('this-run');
    await expect(mail.ignoreExisting('subject:any')).rejects.toThrow('run-owned recipient');
  } finally { globalThis.fetch = saved; }
});

test('Mailpit HTTP errors are detected rather than treated as empty mail', async () => {
  const saved = globalThis.fetch;
  globalThis.fetch = async () => new Response('unavailable', { status: 503 });
  try { await expect(new MailpitClient('http://localhost').searchMessages('to:fixture@example.com')).rejects.toThrow('HTTP 503'); }
  finally { globalThis.fetch = saved; }
});


test('browser mutation evidence retains IDs and excludes response secrets', async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'obp-e2e-ledger-'));
  const previous = process.env.ARTIFACT_DIR;
  process.env.ARTIFACT_DIR = directory;
  try {
    const context = new EventEmitter();
    const drain = observeMutations(context as unknown as BrowserContext);
    context.emit('response', { request: () => ({ method: () => 'POST' }),
      json: async () => ({ user_id: 'owned-id', token: 'never-record-this', password: 'never-record-that' }),
      url: () => 'http://localhost/api/users?token=never-record-query', status: () => 201 });
    await drain();
    const text = readFileSync(path.join(directory, 'mutation-ledger.jsonl'), 'utf8');
    expect(text).toContain('owned-id');
    expect(text).not.toContain('never-record');
    expect(text).toContain('not_verified');
  } finally {
    if (previous === undefined) delete process.env.ARTIFACT_DIR; else process.env.ARTIFACT_DIR = previous;
    rmSync(directory, { recursive: true, force: true });
  }
});
