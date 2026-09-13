// Sentry first, as in main.ts — this process is the unattended one, so it is the one whose
// failures most need somewhere to go.
import './instrument';

import { ConsoleLogger, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { MutationService } from './mutation/mutation.service';
import { TransgeneService } from './transgene/transgene.service';

/**
 * The nightly reload, run by the zfin-data-loader systemd timer. Not a server: it loads both
 * datasets from ZFIN, then exits.
 *
 * createApplicationContext, not create(): this needs the DI container and the database, not an
 * HTTP listener.
 *
 * IT NOW WAITS FOR THE LOAD, AND FAILS LOUDLY. The previous version fired the loads off and slept
 * for 60 seconds before calling process.exit() — a guess that the work would be done by then, with
 * nothing checking. The two services returned as soon as the HTTP request was *issued*, so a slow
 * ZFIN response truncated the load silently, and an error inside the subscribe callback went
 * nowhere at all: no log line, exit code 0, and a green systemd timer over a table that never
 * got written. Awaiting real promises and exiting non-zero on failure is what makes
 * `systemctl status zfin-data-loader` mean something.
 */
async function bootstrap() {
  const logger = new Logger('Loader');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: new ConsoleLogger({ timestamp: true }),
  });

  try {
    const transgeneService = app.get(TransgeneService);
    const mutationService = app.get(MutationService);

    await transgeneService.loadFromZfin();
    await mutationService.loadFromZfin();

    logger.log('Load complete.');
    await app.close();
    process.exit(0);
  } catch (error) {
    logger.error(
      `Load FAILED: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error.stack : undefined,
    );
    await app.close();
    // Non-zero so systemd records a failed unit rather than a successful no-op.
    process.exit(1);
  }
}

bootstrap();
