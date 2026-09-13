import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports ok without touching the database', () => {
    const controller = new HealthController({ isProduction: true } as any);
    expect(controller.health()).toEqual({ status: 'ok', production: true });
  });

  // A dev instance must be distinguishable from a live one by a monitor or a client watermark.
  it('says when it is not production', () => {
    const controller = new HealthController({ isProduction: false } as any);
    expect(controller.health().production).toBe(false);
  });
});
