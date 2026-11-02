import { defineConfig } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';
// Output under the temp directory so the self-test also runs on a read-only image file system.
export default defineConfig({ testDir: './selftest', workers: 1, retries: 0, reporter: 'list',
                              outputDir: path.join(os.tmpdir(), 'obp-e2e-selftest') });
