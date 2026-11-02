import groups from '../../groups.json';

const loopback = new Set(['localhost', '127.0.0.1', '[::1]']);
const blocked = new Set(['ec2admin', '10.0.3.183', '10.0.3.146', '95.128.185.73']);
export function allowedRequest(raw: string): boolean {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (blocked.has(host) || host.includes('ttk')) return false;
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    return process.env.OBP_ISOLATED_TEST_ENV !== '1' || loopback.has(host);
  } catch { return false; }
}

export interface GroupDefinition {
  scope: string;
  mutation: string;
  required: string[];
  cleanup?: string;
}

export function validateRun(values: NodeJS.ProcessEnv = process.env): void {
  const name = values.OBP_E2E_GROUP;
  if (!name || !(name in groups)) throw new Error('BLOCKED: select one group through testing/e2e/run.py');
  validateGroup(name, groups[name as keyof typeof groups], values);
}

// Separate from validateRun so the controls can check the guards against group definitions no real group has.
export function validateGroup(name: string, group: GroupDefinition, values: NodeJS.ProcessEnv): void {
  const idp = values.LOGIN_IDP || values.OIDC_LOGIN_PROVIDER || 'obp-oidc';
  if (idp !== 'obp-oidc' && idp !== 'keycloak') {
    throw new Error('BLOCKED: imported suite supports OBP-OIDC and Keycloak only');
  }
  if (idp === 'keycloak' && !(values.KEYCLOAK_BASE && values.KEYCLOAK_REALM)) {
    throw new Error('BLOCKED: missing KEYCLOAK_BASE or KEYCLOAK_REALM for a Keycloak login');
  }
  for (const key of group.required) {
    if (!values[key]) throw new Error(`BLOCKED: missing ${key}`);
  }
  for (const key of ['TARGET_BASE', 'API_BASE', 'APIM_URL', 'PORTAL_URL', 'HOLA_URL', 'OIDC_BASE', 'KEYCLOAK_BASE',
                     'MAILPIT_API_URL', 'API_MANAGER_BASE_URL', 'OBP_PORTAL_BASE_URL', 'HOLA_BASE_URL']) {
    const raw = values[key];
    if (!raw) continue;
    const url = new URL(raw);
    if (blocked.has(url.hostname.toLowerCase()) || url.hostname.toLowerCase().includes('ttk') || url.username || url.password) {
      throw new Error(`BLOCKED: forbidden endpoint in ${key}`);
    }
    // Plain HTTP only on loopback, and for the in-cluster Mailpit API (Kubernetes service names have no certificate).
    const inClusterMailpit = key === 'MAILPIT_API_URL' && url.hostname.endsWith('.svc.cluster.local');
    if (!['https:', 'http:'].includes(url.protocol) || (url.protocol === 'http:' && !loopback.has(url.hostname) && !inClusterMailpit)) {
      throw new Error(`BLOCKED: insecure endpoint in ${key}`);
    }
    if (group.scope === 'isolated' && !loopback.has(url.hostname)) throw new Error(`BLOCKED: isolated endpoint required in ${key}`);
  }
  if (group.scope === 'isolated' && (values.OBP_ISOLATED_TEST_ENV !== '1' || values.OBP_ALLOW_TEST_WRITES !== '1')) {
    throw new Error('BLOCKED: disposable environment and OBP_ALLOW_TEST_WRITES=1 required; cleanup is not automated');
  }
  if (group.mutation === 'abuse' && values.OBP_ALLOW_ABUSE_TESTS !== '1') throw new Error('BLOCKED: rate-limit tests require explicit opt-in');
  if (name === 'vrp' && !values.TEST_OTP_VALUE && !(values.MAILPIT_API_URL && /(?:^|\s)to:\S+/.test(values.OTP_MAILPIT_QUERY || ''))) {
    throw new Error('BLOCKED: configure an isolated fixed OTP or Mailpit and a run-owned recipient query');
  }
  // A run must leave no data behind, so a group runs only once it declares how its data is removed
  // ('none', or a routine the obp-server-k3s run wrapper performs through OBP endpoints).
  const cleanup = group.cleanup;
  if (!cleanup || cleanup === 'missing') {
    throw new Error(`BLOCKED: group ${name} has no cleanup routine yet`);
  }
}
