import { LoggingMiddleware } from './logging.middleware';

/** Drive the `finish` handler the middleware registers on the response. */
function run(middleware: LoggingMiddleware, url: string, statusCode: number) {
  let finish: () => void = () => undefined;
  const req: any = { method: 'GET', originalUrl: url };
  const res: any = {
    statusCode,
    on: (_e: string, cb: () => void) => (finish = cb),
  };
  const next = jest.fn();
  middleware.use(req, res, next);
  expect(next).toHaveBeenCalled();
  finish();
}

describe('LoggingMiddleware', () => {
  let middleware: LoggingMiddleware;
  let log: jest.SpyInstance;
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    middleware = new LoggingMiddleware();
    log = jest.spyOn(middleware['logger'], 'log').mockImplementation();
    warn = jest.spyOn(middleware['logger'], 'warn').mockImplementation();
    error = jest.spyOn(middleware['logger'], 'error').mockImplementation();
  });

  it('logs method, path and status for a successful request', () => {
    run(middleware, '/mutation/allele/sa12986', 200);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('GET /mutation/allele/sa12986 200'),
    );
  });

  it('escalates 4xx to warn and 5xx to error', () => {
    run(middleware, '/nope', 404);
    expect(warn).toHaveBeenCalled();
    run(middleware, '/boom', 500);
    expect(error).toHaveBeenCalled();
  });

  // The query string is deliberately dropped rather than logged.
  it('does not log the query string', () => {
    run(middleware, '/mutation/allele/x?secret=value', 200);
    expect(log).toHaveBeenCalledWith(expect.not.stringContaining('secret'));
  });
});
