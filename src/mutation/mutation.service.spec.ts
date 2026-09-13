import { of } from 'rxjs';

import { makeFakeRepo } from '../testing/repo.fake';
import { MutationService } from './mutation.service';

const URL = 'http://zfin.test/features-affected-genes.txt';

// Field order per zfin-mutation-record.ts: id, SO id, abbreviation, gene symbol, gene id, ...
const row = (id: string, allele: string, featureType = 'POINT_MUTATION') =>
  [
    id,
    'SO:1000008',
    allele,
    'gene',
    'ZDB-GENE-1',
    'SO:0001217',
    'is allele of',
    featureType,
  ].join('\t');

/** Build the service over a fake repo and a fixed download body. */
function subject(body: string, recordsPerInsert = 2) {
  const fake = makeFakeRepo();
  const httpService = { get: jest.fn(() => of({ data: body })) } as any;
  const configService = {
    zfinMutationUrl: URL,
    recordsPerInsert,
  } as any;
  const service = new MutationService(configService, fake.repo, httpService);
  jest.spyOn(service['logger'], 'log').mockImplementation();
  return { service, fake, httpService };
}

describe('MutationService.loadFromZfin', () => {
  it('clears the table, then inserts the parsed rows', async () => {
    const { service, fake } = subject(
      [row('ZDB-ALT-1', 'a1'), row('ZDB-ALT-2', 'a2')].join('\n'),
      10,
    );

    await service.loadFromZfin();

    expect(fake.deletes()).toBe(1);
    // Order matters: a delete that ran after the inserts would leave an empty table.
    expect(fake.ops[0].type).toBe('delete');
    expect(
      fake
        .batches()
        .flat()
        .map((m: any) => m.alleleName),
    ).toEqual(['a1', 'a2']);
  });

  it('drops deficiencies and translocations', async () => {
    const { service, fake } = subject(
      [
        row('ZDB-ALT-1', 'keep'),
        row('ZDB-ALT-2', 'df', 'DEFICIENCY'),
        row('ZDB-ALT-3', 'tr', 'TRANSLOC'),
      ].join('\n'),
      10,
    );

    await service.loadFromZfin();

    expect(
      fake
        .batches()
        .flat()
        .map((m: any) => m.alleleName),
    ).toEqual(['keep']);
  });

  // The batching loop was rewritten from a push-and-count form to a slice form. These two cases are
  // where such a rewrite goes wrong: a dropped remainder, or an extra empty final batch.
  describe('batching', () => {
    it('splits into RECORDS_PER_INSERT-sized batches and keeps the remainder', async () => {
      const rows = Array.from({ length: 5 }, (_, i) =>
        row(`ZDB-ALT-${i}`, `a${i}`),
      );
      const { service, fake } = subject(rows.join('\n'), 2);

      await service.loadFromZfin();

      expect(fake.batches().map((b) => b.length)).toEqual([2, 2, 1]);
      expect(fake.batches().flat()).toHaveLength(5);
    });

    it('does not emit a trailing empty batch when the count divides exactly', async () => {
      const rows = Array.from({ length: 4 }, (_, i) =>
        row(`ZDB-ALT-${i}`, `a${i}`),
      );
      const { service, fake } = subject(rows.join('\n'), 2);

      await service.loadFromZfin();

      expect(fake.batches().map((b) => b.length)).toEqual([2, 2]);
    });
  });

  // The guard that matters: an upstream outage must not become a data outage.
  describe('when the download is not the file we expected', () => {
    it('throws and leaves the table alone for an HTML error page served with a 200', async () => {
      const { service, fake } = subject(
        '<!DOCTYPE html>\n<html><head><title>503</title></head></html>\n',
      );

      await expect(service.loadFromZfin()).rejects.toThrow(
        /produced no usable records/,
      );
      expect(fake.deletes()).toBe(0);
      expect(fake.batches()).toHaveLength(0);
    });

    it('throws and leaves the table alone for an empty body', async () => {
      const { service, fake } = subject('');

      await expect(service.loadFromZfin()).rejects.toThrow(
        /produced no usable records/,
      );
      expect(fake.deletes()).toBe(0);
    });

    it('names the URL in the error, so the log says which source failed', async () => {
      const { service } = subject('nonsense\n');
      await expect(service.loadFromZfin()).rejects.toThrow(URL);
    });
  });

  it('propagates a transport failure rather than clearing the table', async () => {
    const fake = makeFakeRepo();
    const httpService = {
      get: jest.fn(() => {
        throw new Error('ECONNREFUSED');
      }),
    } as any;
    const service = new MutationService(
      { zfinMutationUrl: URL, recordsPerInsert: 10 } as any,
      fake.repo,
      httpService,
    );
    jest.spyOn(service['logger'], 'log').mockImplementation();

    await expect(service.loadFromZfin()).rejects.toThrow('ECONNREFUSED');
    expect(fake.deletes()).toBe(0);
  });

  it('asks for the URL the config gives it, as text', async () => {
    const { service, httpService } = subject(row('ZDB-ALT-1', 'a1'), 10);
    await service.loadFromZfin();
    expect(httpService.get).toHaveBeenCalledWith(URL, { responseType: 'text' });
  });
});

describe('MutationService.findByAlleleName', () => {
  it('looks the allele up by name', async () => {
    const { service, fake } = subject('', 10);
    await service.findByAlleleName('sa12986');
    expect(fake.repo.findOne).toHaveBeenCalledWith({
      where: { alleleName: 'sa12986' },
    });
  });
});
