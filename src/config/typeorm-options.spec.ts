import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { buildTypeOrmOptions } from './typeorm-options';

const base = {
  host: 'h',
  port: 3306,
  username: 'u',
  password: 'p',
  database: 'db',
  entities: ['e'],
  migrations: ['m'],
};

describe('buildTypeOrmOptions', () => {
  it('builds a plaintext mysql connection by default (no ssl, no sync)', () => {
    const o = buildTypeOrmOptions(base);
    expect(o.type).toBe('mysql');
    expect(o.ssl).toBeUndefined();
    expect(o.synchronize).toBe(false);
    expect(o.migrationsRun).toBe(false);
    expect(o.logging).toEqual(['error']);
  });

  it('reads the CA file into ssl.ca when sslCaPath is given (the DO Managed MySQL path)', () => {
    const caPath = path.join(os.tmpdir(), `zfm-test-ca-${process.pid}.crt`);
    fs.writeFileSync(caPath, 'FAKE-CA-PEM');
    try {
      const o = buildTypeOrmOptions({ ...base, sslCaPath: caPath });
      expect(o.ssl).toEqual({ ca: 'FAKE-CA-PEM' });
    } finally {
      fs.unlinkSync(caPath);
    }
  });

  it('adds query logging only when asked', () => {
    expect(buildTypeOrmOptions({ ...base, logQueries: true }).logging).toEqual([
      'error',
      'query',
    ]);
  });
});
