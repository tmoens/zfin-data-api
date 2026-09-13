import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

/**
 * One line per completed request: method, path, status, duration.
 *
 * Logs no query strings and no bodies. This API has no credentials to leak, but the allele being
 * looked up is a facility's research subject and there is no reason to write it to a log that
 * outlives the request.
 */
@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const started = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - started;
      const line = `${req.method} ${req.originalUrl.split('?')[0]} ${
        res.statusCode
      } ${ms}ms`;
      if (res.statusCode >= 500) this.logger.error(line);
      else if (res.statusCode >= 400) this.logger.warn(line);
      else this.logger.log(line);
    });
    next();
  }
}
