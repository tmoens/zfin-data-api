import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { CONFIG_FILE_NAME, ConfigService } from './config.service';

// A complete, valid deployment config — the baseline each test mutates.
const VALID = `
NODE_ENV=development
PORT=3480
PUBLIC_URL=https://zfin.example.com
DB_NAME=zfin_data
DB_USER=zfin_data
DB_PASSWORD=secret
DB_HOST=db.example.com
DB_PORT=25060
ZFIN_MUTATION_URL=https://zfin.org/downloads/features-affected-genes.txt
ZFIN_TRANSGENE_URL=https://zfin.org/downloads/tgInsertions.txt
`.trim();

/** Write `contents` as a config file in a fresh dir and point ConfigService at it. */
function withConfig<T>(contents: string, fn: () => T): T {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zfin-api-cfg-'));
  fs.writeFileSync(path.join(dir, CONFIG_FILE_NAME), contents);
  const previous = process.env.ZFIN_API_CONFIG_DIR;
  process.env.ZFIN_API_CONFIG_DIR = dir;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.ZFIN_API_CONFIG_DIR;
    else process.env.ZFIN_API_CONFIG_DIR = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('ConfigService', () => {
  it('reads a complete config and exposes the DB connection', () => {
    withConfig(VALID, () => {
      const c = new ConfigService();
      expect(c.port).toBe(3480);
      expect(c.dbConnection).toEqual({
        host: 'db.example.com',
        port: 25060,
        username: 'zfin_data',
        password: 'secret',
        database: 'zfin_data',
        sslCaPath: undefined,
      });
    });
  });

  it('says where to look when there is no config file at all', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zfin-api-empty-'));
    const previous = process.env.ZFIN_API_CONFIG_DIR;
    process.env.ZFIN_API_CONFIG_DIR = dir;
    try {
      expect(() => new ConfigService()).toThrow(
        new RegExp(`No configuration file at .*${CONFIG_FILE_NAME}`),
      );
    } finally {
      if (previous === undefined) delete process.env.ZFIN_API_CONFIG_DIR;
      else process.env.ZFIN_API_CONFIG_DIR = previous;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // THE POINT OF THE ALLOWLIST. A misspelt key must stop the server and name itself, rather than
  // being ignored while the value it was meant to set quietly takes its default.
  it('refuses to start on an unrecognised key, and names it', () => {
    withConfig(`${VALID}\nDB_HSOT=db.example.com`, () => {
      expect(() => new ConfigService()).toThrow(/"DB_HSOT" is not allowed/);
    });
  });

  it('refuses to start when a required key is missing', () => {
    withConfig(VALID.replace(/^DB_PASSWORD=.*$/m, ''), () => {
      expect(() => new ConfigService()).toThrow(/"DB_PASSWORD" is required/);
    });
  });

  // Joi coerces these; the getters must not re-coerce, because Boolean('false') is true and that
  // would turn synchronize ON for a deployment whose file says it is off.
  it('reads booleans as written, not as truthy strings', () => {
    withConfig(
      `${VALID}\nTYPEORM_SYNC_DATABASE=false\nALLOW_LOADING_VIA_API=false`,
      () => {
        const c = new ConfigService();
        expect(c.typeORMSync).toBe(false);
        expect(c.allowLoadingViaApi).toBe(false);
      },
    );
    withConfig(`${VALID}\nALLOW_LOADING_VIA_API=true`, () => {
      expect(new ConfigService().allowLoadingViaApi).toBe(true);
    });
  });

  it('exposes every configured value it was asked for', () => {
    withConfig(
      `${VALID}\nRECORDS_PER_INSERT=500\nSENTRY_DSN=https://key@sentry.example.com/1`,
      () => {
        const c = new ConfigService();
        expect(c.nodeEnv).toBe('development');
        expect(c.isProduction).toBe(false);
        expect(c.publicUrl).toBe('https://zfin.example.com');
        expect(c.zfinMutationUrl).toContain('features-affected-genes.txt');
        expect(c.zfinTransgeneUrl).toContain('tgInsertions.txt');
        expect(c.recordsPerInsert).toBe(500);
        expect(c.sentryDsn).toBe('https://key@sentry.example.com/1');
        expect(c.typeORMLogQueries).toBe(false);
      },
    );
  });

  // The Joi default is `process.env.NODE_ENV || 'production'`, so what an omitted NODE_ENV means
  // depends on the AMBIENT environment. Both halves are worth pinning down, and the test has to
  // control that variable rather than inherit jest's own NODE_ENV=test.
  describe('when the config file omits NODE_ENV', () => {
    const noNodeEnv = VALID.replace(/^NODE_ENV=.*$/m, '');

    /** Run `fn` with process.env.NODE_ENV forced to `value` (or removed when undefined). */
    const withAmbient = (value: string | undefined, fn: () => void) => {
      const previous = process.env.NODE_ENV;
      if (value === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = value;
      try {
        fn();
      } finally {
        if (previous === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previous;
      }
    };

    // The production case: the systemd unit sets no NODE_ENV, so nothing is inherited and the
    // default applies. A server has to DECLARE itself non-production to be treated as such.
    it('answers production when nothing is set anywhere', () => {
      withAmbient(undefined, () => {
        withConfig(noNodeEnv, () => {
          expect(new ConfigService().isProduction).toBe(true);
        });
      });
    });

    it('inherits an ambient NODE_ENV when one is set', () => {
      withAmbient('development', () => {
        withConfig(noNodeEnv, () => {
          const c = new ConfigService();
          expect(c.nodeEnv).toBe('development');
          expect(c.isProduction).toBe(false);
        });
      });
    });
  });

  it('reports no Sentry DSN as undefined rather than an empty string', () => {
    withConfig(VALID, () => {
      expect(new ConfigService().sentryDsn).toBeUndefined();
    });
  });

  it('passes a CA certificate path through to the DB connection', () => {
    withConfig(
      `${VALID}\nDB_SSL_CA=/etc/zfin-data-api/do-db-service.crt`,
      () => {
        expect(new ConfigService().dbConnection.sslCaPath).toBe(
          '/etc/zfin-data-api/do-db-service.crt',
        );
      },
    );
  });

  it('defaults the bind address to loopback and the reload route to off', () => {
    withConfig(VALID, () => {
      const c = new ConfigService();
      expect(c.host).toBe('127.0.0.1');
      expect(c.allowLoadingViaApi).toBe(false);
      expect(c.typeORMSync).toBe(false);
      expect(c.typeORMMigrationRun).toBe(false);
    });
  });
});
