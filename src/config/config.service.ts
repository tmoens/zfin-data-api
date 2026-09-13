import * as fs from 'node:fs';
import * as path from 'node:path';

import * as dotenv from 'dotenv';
import * as Joi from 'joi';

export interface EnvConfig {
  [prop: string]: string;
}

/** Where the deployment env file lives when nothing says otherwise. */
export const DEFAULT_CONFIG_DIR = '/etc/zfin-data-api';
/** The file's name within that directory. */
export const CONFIG_FILE_NAME = 'zfin-data-api.env';

/**
 * Pure validated-env access for DEPLOYMENT config. The TypeORM wiring lives in the factory class
 * beside this file (typeorm-config.factory.ts), which consumes the connection getter below.
 *
 * Ported from zf-server's ConfigService, with one deliberate difference. zf-server is multi-tenant:
 * a FACILITY variable selects which of several env files to read. This service has exactly one
 * deployment, so there is nothing to select — it reads ONE file, whose directory is
 * ZFIN_API_CONFIG_DIR (default /etc/zfin-data-api).
 *
 * THE CONFIG LIVES OUTSIDE THE CHECKOUT. That is the point of the default: a deploy is `git pull`
 * plus a rebuild, and it must be structurally incapable of touching the database password. The
 * previous arrangement kept a world-readable .env inside /var/www/zfin-data-api, which was both
 * one `git clean` from deletion and readable by every account on the host.
 *
 * THE SERVER AND THE LOADER READ THE SAME FILE. They are two processes over one database and one
 * ZFIN source; splitting their config would be two places to change a password.
 */
export class ConfigService {
  private readonly envConfig: EnvConfig;
  readonly configFilePath: string;

  constructor() {
    const dir = process.env.ZFIN_API_CONFIG_DIR || DEFAULT_CONFIG_DIR;
    this.configFilePath = path.join(dir, CONFIG_FILE_NAME);

    if (!fs.existsSync(this.configFilePath)) {
      throw new Error(
        `No configuration file at ${this.configFilePath}.\n` +
          `  In production this file belongs in ${DEFAULT_CONFIG_DIR}/, owned by the service user and chmod 600.\n` +
          `  In development, point ZFIN_API_CONFIG_DIR at your own copy, e.g.\n` +
          `    cp environments/sample.env environments/${CONFIG_FILE_NAME}\n` +
          `    export ZFIN_API_CONFIG_DIR=environments\n` +
          `  See environments/sample.env for every key this server accepts.`,
      );
    }
    const config = dotenv.parse(fs.readFileSync(this.configFilePath));
    this.envConfig = ConfigService.validateInput(config);
  }

  get port(): number {
    return Number(this.envConfig.PORT);
  }

  /**
   * The interface the server binds to. Defaults to loopback because the only thing that should ever
   * reach this process directly is Caddy, running on the same host. Nest's own default is
   * 0.0.0.0 — every interface — which leaves the port listening to the internet, saved from
   * exposure only by a firewall rule nothing in this repo controls. A loopback bind does not
   * depend on the firewall being right.
   */
  get host(): string {
    return this.envConfig.HOST;
  }

  get nodeEnv(): string {
    return this.envConfig.NODE_ENV;
  }

  /**
   * Is this a production server? Reported by GET /health.
   *
   * DELIBERATELY "is it production" rather than "is it development": the Joi default for NODE_ENV
   * is `production`, so a missing or misspelt value answers TRUE. A server has to declare itself
   * non-production, and the failure mode is a dev box mislabelled rather than a live one.
   */
  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  // Joi has already coerced these to real booleans (Joi.boolean() parses the strings 'true'/'false'),
  // so they are returned as-is. Do NOT wrap them in Boolean(): applied to the raw string from the
  // file, Boolean('false') is true, which is the exact bug that would turn synchronize off in the
  // file and on in the server.
  get typeORMLogQueries(): boolean {
    return this.envConfig.TYPEORM_LOG_QUERIES as unknown as boolean;
  }

  get typeORMSync(): boolean {
    return this.envConfig.TYPEORM_SYNC_DATABASE as unknown as boolean;
  }

  get typeORMMigrationRun(): boolean {
    return this.envConfig.TYPEORM_MIGRATION_RUN as unknown as boolean;
  }

  /** The public base URL this API answers on — used only to describe itself on GET /. */
  get publicUrl(): string {
    return this.envConfig.PUBLIC_URL;
  }

  get zfinMutationUrl(): string {
    return this.envConfig.ZFIN_MUTATION_URL;
  }

  get zfinTransgeneUrl(): string {
    return this.envConfig.ZFIN_TRANSGENE_URL;
  }

  /** How many rows to put in one INSERT when reloading. See the schema note below. */
  get recordsPerInsert(): number {
    return Number(this.envConfig.RECORDS_PER_INSERT);
  }

  /**
   * May a plain GET trigger a full reload? See the schema note — this is off unless a deployment
   * says otherwise, and production should never say otherwise.
   */
  get allowLoadingViaApi(): boolean {
    return this.envConfig.ALLOW_LOADING_VIA_API as unknown as boolean;
  }

  get sentryDsn(): string | undefined {
    return this.envConfig.SENTRY_DSN || undefined;
  }

  /**
   * The env file holds DEPLOYMENT/SECRET config only (restart-to-apply): DB, port, ZFIN source
   * URLs, loader batch size.
   *
   * THE SCHEMA IS AN ALLOWLIST: an unrecognised key is an error, not something ignored, so a typo
   * stops the server and names itself rather than silently taking a default. Returns the validated
   * object with defaults applied.
   */
  private static validateInput(envConfig: EnvConfig): EnvConfig {
    const envVarsSchema: Joi.ObjectSchema = Joi.object({
      NODE_ENV: Joi.string()
        .valid('development', 'production', 'test')
        .default(process.env.NODE_ENV || 'production'),

      PORT: Joi.number().required(),
      // Loopback by default — see the `host` getter. A deployment that genuinely needs to be
      // reached from off-box can set 0.0.0.0, and then it has said so out loud.
      HOST: Joi.string().default('127.0.0.1'),

      // This API's own public base URL. Used only by GET / to describe its own endpoints, so it is
      // cosmetic — but a wrong value hands a caller a URL that does not work, so it is required
      // rather than guessed from the request.
      PUBLIC_URL: Joi.string().required(),

      DB_NAME: Joi.string().required(),
      DB_USER: Joi.string().required(),
      DB_PASSWORD: Joi.string().required(),
      DB_HOST: Joi.string().optional().default('localhost'),
      DB_PORT: Joi.number().optional().default(3306),
      // Path to a CA certificate file when the DB requires verified TLS (DO Managed MySQL 8 in
      // prod, port 25060). Omit for a plaintext local connection (the dev container).
      DB_SSL_CA: Joi.string().optional(),

      TYPEORM_SYNC_DATABASE: Joi.boolean().default(false),
      TYPEORM_MIGRATION_RUN: Joi.boolean().default(false),
      TYPEORM_LOG_QUERIES: Joi.boolean().default(false),

      // Where the nightly reload gets its data. Required: a default pointing at zfin.org would mean
      // a misconfigured dev box silently hammering ZFIN's real download endpoints.
      ZFIN_MUTATION_URL: Joi.string().required(),
      ZFIN_TRANSGENE_URL: Joi.string().required(),

      // Rows per INSERT during a reload. Too large and the statement exceeds the server's
      // max_allowed_packet; the whole load is ~50,000 mutations and 10,000 at a time is about two
      // seconds per batch.
      RECORDS_PER_INSERT: Joi.number().default(10000),

      // Whether GET /mutation/loadFromZfin and /transgene/loadFromZfin may trigger a full reload.
      // FALSE IN PRODUCTION, always: the route has no authentication, so anyone who learns the URL
      // can drop and rebuild both tables at will. The nightly loader does not use it — it calls the
      // services directly — so production has no reason to turn it on.
      ALLOW_LOADING_VIA_API: Joi.boolean().default(false),

      // Error-tracking DSN (Sentry). Optional — absent in dev means errors simply are not reported.
      SENTRY_DSN: Joi.string().optional(),
    });

    const { error, value: validatedEnvConfig } =
      envVarsSchema.validate(envConfig);
    if (error) {
      throw new Error(`Config validation error: ${error.message}`);
    }
    return validatedEnvConfig;
  }

  /** The DB connection values (deployment env) — consumed by TypeOrmConfigFactory and anything
   *  else building a connection via `buildTypeOrmOptions`. */
  get dbConnection(): {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    sslCaPath?: string;
  } {
    return {
      host: this.envConfig.DB_HOST,
      port: Number(this.envConfig.DB_PORT),
      username: this.envConfig.DB_USER,
      password: this.envConfig.DB_PASSWORD,
      database: this.envConfig.DB_NAME,
      sslCaPath: this.envConfig.DB_SSL_CA || undefined,
    };
  }
}
