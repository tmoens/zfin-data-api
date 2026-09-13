import { readFileSync } from 'node:fs';

import { LoggerOptions } from 'typeorm/logger/LoggerOptions';

// The ONE place TypeORM connection options are built. Three consumers share it, differing only in
// where the inputs come from:
//   - the app          (TypeOrmConfigFactory <- ConfigService / the deployment env file)
//   - the loader       (the same, via the same AppModule)
//   - the migration CLI (data-source.ts <- plain DB_* env vars)
// Pure and framework-free so any of them can call it directly.
//
// Lifted from zf-server/src/config/typeorm-options.ts so the two servers build a connection the
// same way; keep them in step.

export interface TypeOrmConnectionInput {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  /**
   * Path to a CA certificate file when the server requires verified TLS (DO Managed MySQL 8 in
   * prod, on port 25060). Omit for a plaintext local connection (the dev container).
   */
  sslCaPath?: string;
  /** Entity/migration globs — each consumer resolves these relative to its own module. */
  entities: string[];
  migrations: string[];
  logQueries?: boolean;
  synchronize?: boolean;
  migrationsRun?: boolean;
}

export function buildTypeOrmOptions(input: TypeOrmConnectionInput) {
  const logging: LoggerOptions = input.logQueries
    ? ['error', 'query']
    : ['error'];
  return {
    type: 'mysql' as const,
    host: input.host,
    port: input.port,
    username: input.username,
    password: input.password,
    database: input.database,
    entities: input.entities,
    migrations: input.migrations,
    synchronize: input.synchronize ?? false,
    migrationsRun: input.migrationsRun ?? false,
    logging,
    ssl: input.sslCaPath
      ? { ca: readFileSync(input.sslCaPath, 'utf8') }
      : undefined,
  };
}
