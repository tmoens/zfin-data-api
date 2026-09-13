import 'reflect-metadata';

import { join } from 'node:path';

import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';

import { buildTypeOrmOptions } from './config/typeorm-options';

// Standalone DataSource for the TypeORM migration CLI (generate/run/revert/show).
//
// It runs OUTSIDE Nest, so it deliberately does NOT go through ConfigService — that class requires
// a complete deployment env file (PUBLIC_URL, the ZFIN source URLs, ...) which the migration
// workflow has no reason to supply, and it reads it from /etc, which the operator running a
// migration may not have. Instead it reads the DB_* vars straight from the environment and
// DEFAULTS to the local MySQL 8 container in docker-compose.yml (host port 3309).
//
// MIGRATIONS RUN ON THE ADMIN PLANE. The credential here creates and alters tables; the runtime
// credential in the deployment env file holds SELECT/INSERT/UPDATE/DELETE and nothing more. They
// are different users on purpose — see the credential model in the deployment docs.
//
// Override any value via the shell or an optional .env file at the repo root, e.g. at cutover:
//   DB_HOST=... DB_PORT=25060 DB_NAME=zfin_data DB_USER=doadmin DB_PASSWORD=... \
//     DB_SSL_CA=/etc/zfin-data-api/do-db-service.crt npm run migration:run
loadEnv();

const options = buildTypeOrmOptions({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3309),
  username: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? 'rootpass',
  database: process.env.DB_NAME ?? 'zfin_data',
  // Prod (DO Managed MySQL 8) requires TLS verified against a CA cert; the local container speaks
  // plaintext, so omit DB_SSL_CA unless targeting a TLS server.
  sslCaPath: process.env.DB_SSL_CA,
  // Load every entity so `migration:generate` can diff the model against the DB.
  entities: [join(__dirname, '**', '*.entity{.ts,.js}')],
  migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
});

export default new DataSource(options);
