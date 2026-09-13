import * as fs from 'node:fs';
import * as path from 'node:path';

import * as Sentry from '@sentry/nestjs';
import * as dotenv from 'dotenv';

import { CONFIG_FILE_NAME, DEFAULT_CONFIG_DIR } from './config/config.service';

// Sentry bootstrap — imported FIRST by main.ts and loader.ts, before Nest exists (required so its
// instrumentation wraps everything). ConfigService isn't constructed yet, so the deployment env
// file is read directly here for the one key this needs; validation of that file still happens in
// ConfigService moments later. With no SENTRY_DSN configured (e.g. dev), this is a complete no-op —
// the process runs normally and errors simply aren't reported anywhere.
const dir = process.env.ZFIN_API_CONFIG_DIR || DEFAULT_CONFIG_DIR;
const envPath = path.join(dir, CONFIG_FILE_NAME);
const env = fs.existsSync(envPath)
  ? dotenv.parse(fs.readFileSync(envPath))
  : {};

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV || 'production',
  });
}
