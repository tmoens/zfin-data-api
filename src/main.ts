// Sentry must be initialized before anything else is imported (its instruction from the docs);
// a no-op when no SENTRY_DSN is configured (dev).
import './instrument';

import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';

async function bootstrap() {
  // Nest's built-in logger, to stdout. Under systemd, journald owns capture/rotation/retention
  // (journalctl -u zfin-data-api); in dev it's your terminal. This replaces the winston
  // daily-rotate-file setup, which wrote into a log/ directory inside the checkout — a second
  // rotation scheme to configure, and log files a deploy could delete.
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({ timestamp: true }),
  });
  app.enableCors();

  const configService: ConfigService = app.get(ConfigService);
  // Bind loopback by default: Caddy is on the same host and is the only thing that should reach
  // this process. See ConfigService.host.
  await app.listen(configService.port, configService.host);
}

bootstrap();
