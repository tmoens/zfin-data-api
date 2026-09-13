import { AppController } from './app.controller';

describe('AppController', () => {
  it('serves the self-description from the service', () => {
    const appService = {
      getHello: jest.fn().mockReturnValue('description'),
    } as any;
    expect(new AppController(appService).getHello()).toBe('description');
  });
});
