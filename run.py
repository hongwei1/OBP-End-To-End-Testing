#!/usr/bin/env python3
"""Run one Playwright group with the safety checks; the container image's entry point.

Results go to ARTIFACT_DIR, or to OBP_TEST_RESULTS_DIR/<time>-<group> (the Job mounts /results), or to ./test-results.
"""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from types import SimpleNamespace
from urllib.parse import urlsplit

HERE = Path(__file__).resolve().parent
GROUPS = json.loads((HERE / 'groups.json').read_text())

# Same rules as validate_urls in obp-server-k3s testing/run.py, kept here so the image needs nothing else.
BLOCKED_HOSTS = {'ec2admin', '10.0.3.183', '10.0.3.146', '95.128.185.73'}
URL_KEYS = {'TARGET_BASE', 'API_BASE', 'OIDC_BASE', 'PORTAL_URL', 'APIM_URL', 'HOLA_URL', 'EXPLORER_URL', 'MCP_URL',
            'KEYCLOAK_BASE', 'API_MANAGER_BASE_URL', 'OBP_PORTAL_BASE_URL', 'HOLA_BASE_URL', 'MAILPIT_API_URL'}


def validate_urls(env):
    for key in URL_KEYS:
        if not env.get(key):
            continue
        parts = urlsplit(env[key])
        host = (parts.hostname or '').lower()
        if host in BLOCKED_HOSTS or 'ttk' in host:
            raise ValueError(f'Forbidden host in {key}')
        if parts.scheme not in ('http', 'https') or not host or parts.username or parts.password:
            raise ValueError(f'Invalid URL in {key}')
        in_cluster_mailpit = key == 'MAILPIT_API_URL' and host.endswith('.svc.cluster.local')
        if parts.scheme == 'http' and host not in {'localhost', '127.0.0.1', '::1'} and not host.endswith('.obp.local') \
                and not in_cluster_mailpit:
            raise ValueError(f'Remote {key} must use HTTPS')


runner = SimpleNamespace(validate_urls=validate_urls, URL_KEYS=URL_KEYS)


def prepare(group, values):
    env = values.copy()
    aliases = {'API_MANAGER_BASE_URL': 'APIM_URL', 'OBP_PORTAL_BASE_URL': 'PORTAL_URL', 'HOLA_BASE_URL': 'HOLA_URL'}
    for target, source in aliases.items():
        if env.get(source):
            env[target] = env[source]
    # The remote groups act as the ordinary test user, which gets the roles a group needs only for its run.
    if group in ('login', 'create-bank', 'dynamic-entity', 'entitlements', 'registration', 'create-bank-new-user'):
        for key, source in {'POWERFUL_USER_1_USERNAME': 'LOGIN_USERNAME', 'POWERFUL_USER_1_PASSWORD': 'LOGIN_PASSWORD',
                            'POWERFUL_USER_1_CREDENTIALS_PROVIDER': 'LOGIN_PROVIDER'}.items():
            if env.get(source):
                env[key] = env[source]
    env['OBP_LOGIN_USERNAME'] = env.get('LOGIN_USERNAME', '')
    env['OBP_LOGIN_PASSWORD'] = env.get('LOGIN_PASSWORD', '')
    env['OIDC_LOGIN_PROVIDER'] = env.get('LOGIN_IDP', 'obp-oidc')
    env['OBP_E2E_GROUP'] = group
    # Provider of the credential store is separate from the selected IdP implementation.
    if env.get('LOGIN_PROVIDER'):
        env['OBP_CREDENTIALS_PROVIDER'] = env['LOGIN_PROVIDER']
    runner.validate_urls(env)
    missing = [key for key in GROUPS[group]['required'] if not env.get(key)]
    if env['OIDC_LOGIN_PROVIDER'] not in ('obp-oidc', 'keycloak'):
        missing.append('imported suite supports OBP-OIDC and Keycloak only')
    if env['OIDC_LOGIN_PROVIDER'] == 'keycloak' and not (env.get('KEYCLOAK_BASE') and env.get('KEYCLOAK_REALM')):
        missing.append('KEYCLOAK_BASE and KEYCLOAK_REALM for a Keycloak login')
    if GROUPS[group]['scope'] == 'isolated':
        if env.get('OBP_ISOLATED_TEST_ENV') != '1' or env.get('OBP_ALLOW_TEST_WRITES') != '1':
            missing.append('disposable environment and OBP_ALLOW_TEST_WRITES=1; cleanup not automated')
        from urllib.parse import urlsplit
        for key in runner.URL_KEYS:
            if env.get(key) and urlsplit(env[key]).hostname not in {'localhost', '127.0.0.1', '::1'}:
                missing.append(f'isolated endpoint required: {key}')
    if group == 'rate-limit' and env.get('OBP_ALLOW_ABUSE_TESTS') != '1':
        missing.append('OBP_ALLOW_ABUSE_TESTS=1')
    if group == 'vrp' and not env.get('TEST_OTP_VALUE') and not (env.get('MAILPIT_API_URL') and env.get('OTP_MAILPIT_QUERY')):
        missing.append('TEST_OTP_VALUE or Mailpit OTP query for a run-owned recipient')
    return env, missing


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('group', choices=sorted(GROUPS), nargs='?', default='login')
    parser.add_argument('--selftest', action='store_true', help='Run fake-service controls only')
    parser.add_argument('--list', action='store_true', help='Discover only, without traffic or credentials')
    args = parser.parse_args()
    cli = HERE / 'node_modules/@playwright/test/cli.js'
    if not cli.is_file() or not shutil.which('node'):
        print('BLOCKED: npm ci and Node.js required', file=sys.stderr)
        return 101
    if args.selftest:
        return subprocess.call(['node', str(cli), 'test', '--config=selftest.config.ts'], cwd=HERE)
    if args.list:
        env = os.environ.copy()
    else:
        env, missing = prepare(args.group, os.environ)
        # A run must leave no data behind: a group without a cleanup routine does not run at all.
        if GROUPS[args.group].get('cleanup', 'missing') == 'missing':
            missing.append(f'group {args.group} has no cleanup routine yet')
        if missing:
            print('BLOCKED: ' + ', '.join(missing), file=sys.stderr)
            return 101
        if not env.get('ARTIFACT_DIR') and env.get('OBP_TEST_RESULTS_DIR'):
            stamp = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
            env['ARTIFACT_DIR'] = str(Path(env['OBP_TEST_RESULTS_DIR']) / f'{stamp}-e2e-{args.group}')
        if env.get('ARTIFACT_DIR'):
            print(f"results: {env['ARTIFACT_DIR']}")
    return subprocess.call(['node', str(cli), 'test', *GROUPS[args.group]['paths'], *(['--list'] if args.list else [])], cwd=HERE, env=env)


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (ValueError, OSError) as exc:
        print(f'BLOCKED: {exc}', file=sys.stderr)
        sys.exit(101)
