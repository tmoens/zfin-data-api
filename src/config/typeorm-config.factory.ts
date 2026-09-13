import { join } from 'node:path';

import { Injectable } from '@nestjs/common';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';

import { ConfigService } from './config.service';
import { buildTypeOrmOptions } from './typeorm-options';

/**
 * The APP's TypeORM wiring: deployment env (via ConfigService) -> the shared pure options builder.
 * Registered with `TypeOrmModule.forRootAsync({ useClass: ... })` in app.module. The migration CLI
 * calls `buildTypeOrmOptions` itself with its own target — this class is only the DI adapter for
 * the running server (and the loader, which boots the same AppModule).
 */
@Injectable()
export class TypeOrmConfigFactory implements TypeOrmOptionsFactory {
  constructor(private readonly configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    const db = this.configService.dbConnection;
    return buildTypeOrmOptions({
      ...db,
      // Resolve entities/migrations relative to THIS compiled module, so the globs work whether
      // the app runs from src (ts-node) or dist (compiled) — independent of NODE_ENV.
      entities: [join(__dirname, '..', '**', '*.entity{.ts,.js}')],
      migrations: [join(__dirname, '..', 'migrations', '*{.ts,.js}')],
      logQueries: this.configService.typeORMLogQueries,
      synchronize: this.configService.typeORMSync,
      migrationsRun: this.configService.typeORMMigrationRun,
    });
  }
}
