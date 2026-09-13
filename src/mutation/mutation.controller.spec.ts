import { MutationController } from './mutation.controller';

/**
 * The gate on loadFromZfin. These routes have NO authentication, so `ALLOW_LOADING_VIA_API` is the
 * only thing between a passer-by and dropping/rebuilding the table — which makes it worth a test
 * rather than a code read.
 */
describe('MutationController.loadFromZfin', () => {
  const makeController = (allowLoadingViaApi: boolean) => {
    const service = {
      loadFromZfin: jest.fn().mockResolvedValue('loaded'),
    } as any;
    const controller = new MutationController(
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

  it('logs the refusal, so an attempt is visible rather than silent', async () => {
    const { controller } = makeController(false);
    const warn = jest.spyOn(controller['logger'], 'warn');
    await controller.loadFromZfin();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('disabled'));
  });

  it('loads when explicitly enabled', async () => {
    const { controller, service } = makeController(true);
    await expect(controller.loadFromZfin()).resolves.toBe('loaded');
    expect(service.loadFromZfin).toHaveBeenCalled();
  });
});

describe('MutationController.findByAlleleName', () => {
  it('passes the allele name straight through', () => {
    const service = {
      findByAlleleName: jest.fn().mockReturnValue('record'),
    } as any;
    const controller = new MutationController(
      { allowLoadingViaApi: false } as any,
      service,
    );
    expect(controller.findByAlleleName('sa12986')).toBe('record');
    expect(service.findByAlleleName).toHaveBeenCalledWith('sa12986');
  });
});
