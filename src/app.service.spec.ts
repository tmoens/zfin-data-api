import { AppService } from './app.service';

describe('AppService.getHello', () => {
  // The self-description is built from PUBLIC_URL, so a misconfigured value hands callers URLs that
  // do not work. Cheap to assert that it is used rather than a hardcoded host.
  it('describes its endpoints using the configured public URL', () => {
    const html = new AppService({
      publicUrl: 'https://zfin.example.com',
    } as any).getHello();
    expect(html).toContain('https://zfin.example.com/mutation/allele/');
    expect(html).toContain('https://zfin.example.com/transgene/allele/');
    expect(html).not.toContain('localhost');
  });
});
