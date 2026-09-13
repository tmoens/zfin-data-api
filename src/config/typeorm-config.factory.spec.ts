import { TypeOrmConfigFactory } from './typeorm-config.factory';

/**
 * This class is small but it is the only thing standing between the deployment env file and how the
 * server talks to the database — including whether `synchronize` is on, which is the one setting
 * that could destroy a schema.
 */
describe('TypeOrmConfigFactory', () => {
  const configService = {
    dbConnection: {
      host: 'db.example.com',
      port: 25060,
      username: 'zfin_data',
      password: 'secret',
      database: 'zfin_data',
      sslCaPath: undefined,
    },
    typeORMLogQueries: false,
    typeORMSync: false,
    typeORMMigrationRun: false,
  } as any;

  it('passes the configured connection through to TypeORM', () => {
    const options: any = new TypeOrmConfigFactory(
      configService,
    ).createTypeOrmOptions();
    expect(options).toMatchObject({
      type: 'mysql',
      host: 'db.example.com',
      port: 25060,
      username: 'zfin_data',
      database: 'zfin_data',
    });
  });

  it('keeps synchronize and migrationsRun off when the config says so', () => {
    const options: any = new TypeOrmConfigFactory(
      configService,
    ).createTypeOrmOptions();
    expect(options.synchronize).toBe(false);
    expect(options.migrationsRun).toBe(false);
  });

  // Resolved against the compiled module, so the same globs work under ts-node and under dist.
  it('resolves entity and migration globs relative to its own location', () => {
    const options: any = new TypeOrmConfigFactory(
      configService,
    ).createTypeOrmOptions();
    expect(options.entities[0]).toContain('*.entity');
    expect(options.migrations[0]).toContain('migrations');
    expect(options.entities[0].startsWith('/')).toBe(true);
  });
});
