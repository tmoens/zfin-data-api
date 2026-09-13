import { HttpModule } from '@nestjs/axios';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config/config.module';
import { TypeOrmConfigFactory } from './config/typeorm-config.factory';
import { HealthController } from './health.controller';
import { LoggingMiddleware } from './middleware/logging.middleware';
import { MutationController } from './mutation/mutation.controller';
import { MutationModule } from './mutation/mutation.module';
import { TransgeneController } from './transgene/transgene.controller';
import { TransgeneModule } from './transgene/transgene.module';

@Module({
  imports: [
    // Error tracking: catches unhandled exceptions app-wide (no-op without a SENTRY_DSN).
    SentryModule.forRoot(),
    ConfigModule,
    HttpModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useClass: TypeOrmConfigFactory,
    }),
    MutationModule,
    TransgeneModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    // First filter so Sentry sees exceptions before any other handling.
    { provide: APP_FILTER, useClass: SentryGlobalFilter },
    AppService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggingMiddleware)
      .forRoutes(MutationController, TransgeneController);
  }
}
