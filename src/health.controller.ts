import { Controller, Get } from '@nestjs/common';

import { ConfigService } from './config/config.service';

/**
 * Liveness probe for uptime monitoring (Sentry uptime alerts, UptimeRobot, systemd checks, ...).
 * Deliberately trivial and DB-free: it answers "is the process up and serving HTTP", nothing more.
 *
 * Matches zf-server's /health so one monitor configuration covers both servers.
 */
@Controller()
export class HealthController {
  constructor(private readonly configService: ConfigService) {}

  @Get('health')
  health(): { status: string; production: boolean } {
    return { status: 'ok', production: this.configService.isProduction };
  }
}
