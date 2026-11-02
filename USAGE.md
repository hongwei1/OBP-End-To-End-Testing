# Imported shared Playwright suite

## This branch (`obp-tests-image`)

This branch adds the safety layer below to upstream `ded46e7` and builds the container image used by the
obp-server-k3s test Jobs. `run.py` is the entry point and needs nothing outside this repository:

```sh
npm ci
./node_modules/.bin/tsc --noEmit
python3 run.py --selftest          # offline controls, no traffic
python3 run.py login --list        # discovery only
python3 run.py login               # live; needs APIM_URL, OIDC_BASE, LOGIN_USERNAME, LOGIN_PASSWORD, LOGIN_PROVIDER
```

A run must leave no data behind. Each group in `groups.json` declares `cleanup`; a group whose cleanup is
`missing` is refused by both `run.py` and the Playwright global setup. Only `login` (`cleanup: none`, it creates no
business data) runs today; the obp-server-k3s wrapper audits the database before and after to prove it. Results go to
`ARTIFACT_DIR`, or to `OBP_TEST_RESULTS_DIR/<time>-e2e-<group>`.

The sections below describe the package as first imported into obp-server-k3s (`testing/e2e/` there).

## As imported

Pinned source: OpenBankProject/OBP-End-To-End-Testing at
`ded46e70e16ccb379506de3445de2d682bb5e438`. Nine specs contain 15 discovered tests.
Upstream README and LICENSE are retained. This package's adaptations are tracked
in `../migration-manifest.json`; upstream instructions about default OTP and
inbox clearing are superseded by this guide.

```sh
npm --prefix testing/e2e ci
cd testing/e2e
./node_modules/.bin/tsc --noEmit
node node_modules/@playwright/test/cli.js test --config=selftest.config.ts
cd ../..
python3 testing/e2e/run.py login --list
python3 testing/run.py run --suite e2e-login --env apisandbox --dry-run
```

Discovery and self-tests send no traffic to real apps. Install Chromium using
`testing/e2e/node_modules/.bin/playwright install chromium` before live browser
execution. The existing k6 runtime image does not contain this package's browser
runtime: these new suite entries are workstation-only.

`e2e-login` tests the API Manager via OBP-OIDC using `LOGIN_USERNAME`,
`LOGIN_PASSWORD`, `LOGIN_PROVIDER`, `APIM_URL` and `OIDC_BASE`. The ordinary user is
mapped onto the upstream spec's historically named POWERFUL_USER fields only
for this login group. No elevated role is needed for this login scenario.
`LOGIN_IDP` selects the software; `LOGIN_PROVIDER` selects the credential store.
The imported helper does not support Keycloak. Existing `portal-login` and
`portal-login-k6` remain available for its verified paths.

The other eight groups are restricted to the isolated profile with loopback
URLs, disposable data and `OBP_ALLOW_TEST_WRITES=1`. The rate-limit group also
requires `OBP_ALLOW_ABUSE_TESTS=1`; it was discovered but not executed during
consolidation. No remote write enablement is provided while teardown remains
incomplete. View group-specific required inputs with runner `--dry-run`.

All target aliases and Mailpit URLs must be explicit for the selected group.
`APIM_URL`, `PORTAL_URL` and `HOLA_URL` map to upstream base URL variables. Source
repo `.env` files are not copied. Trust local CAs using OS/browser trust and
`NODE_EXTRA_CA_CERTS` where Node fetch requires it. Public TLS verification stays
on. Timeouts are configurable with `PW_TEST_TIMEOUT_MS`,
`PW_NAVIGATION_TIMEOUT_MS`, `PW_ACTION_TIMEOUT_MS`, `PW_EXPECT_TIMEOUT_MS`.

Mailpit inbox-wide DELETE was replaced by a compatibility no-op. Queries require
a recipient and returned message IDs are not reused by that client. New-user
specs generate unique recipients. VRP needs an explicit isolated fixed
`TEST_OTP_VALUE` or `MAILPIT_API_URL` plus `OTP_MAILPIT_QUERY` naming a run-owned,
fresh OTP mailbox/query. Ambiguous six-digit codes fail. Production email
integration and live OTP retrieval have not been verified.

Outputs live under the run's `ARTIFACT_DIR`: JSON results, HTML report, failed
screenshots/video and trace. These can include credentials entered in forms,
email tokens and user data: keep the run directory restricted; do not commit or
publish it. Retries default to zero so mutating cases are not replayed implicitly.
The runner marks skipped/flaky success as REVIEW and zero-case success as FAIL.

The per-run mutation ledger records response IDs and excludes bodies, tokens and query strings;
it is observation evidence, not proof that an object was newly created or deleted.

Created users, banks, roles and consents are not comprehensively cleaned by these
upstream tests. Use a disposable environment and destroy it after the run.
Passing assertions do not certify cleanup. Remote promotion requires an exact-ID
fixture ledger, verified cleanup and target-specific functional evidence first.
