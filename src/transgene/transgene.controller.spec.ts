import { TransgeneController } from './transgene.controller';

// See mutation.controller.spec.ts — same unauthenticated route, same reason to test the gate.
describe('TransgeneController.loadFromZfin', () => {
  const makeController = (allowLoadingViaApi: boolean) => {
    const service = {
      loadFromZfin: jest.fn().mockResolvedValue('loaded'),
    } as any;
    const controller = new TransgeneController(
      { allowLoadingViaApi } as any,
      service,
    );
    jest.spyOn(controller['logger'], 'warn').mockImplementation();
    return { controller, service };
  };

  it('refuses, and does not touch the service, when loading via the API is off', async () => {
    const { controller, service } = makeController(false);
    await expect(controller.loadFromZfin()).resolves.toBe('Disabled');
    expect(service.loadFromZfin).not.toHaveBeenCalled();
  });

  it('loads when explicitly enabled', async () => {
    const { controller, service } = makeController(true);
    await expect(controller.loadFromZfin()).resolves.toBe('loaded');
    expect(service.loadFromZfin).toHaveBeenCalled();
  });
});

describe('TransgeneController.findByAlleleName', () => {
  it('passes the allele name straight through', () => {
    const service = {
      findByAlleleName: jest.fn().mockReturnValue('record'),
    } as any;
    const controller = new TransgeneController(
      { allowLoadingViaApi: false } as any,
      service,
    );
    expect(controller.findByAlleleName('y1Tg')).toBe('record');
    expect(service.findByAlleleName).toHaveBeenCalledWith('y1Tg');
  });
});
