import { of } from 'rxjs';

import { makeFakeRepo } from '../testing/repo.fake';
import { TransgeneService } from './transgene.service';

const URL = 'http://zfin.test/tgInsertions.txt';

// Field order: id, abbreviation, name, feature SO id, construct id, construct name, construct SO id
const row = (id: string, allele: string, constructId = 'ZDB-TGCONSTRCT-1') =>
  [
    id,
    allele,
    'name',
    'SO:0000804',
    constructId,
    'Tg(fli1:EGFP)',
    'SO:0000804',
  ].join('\t');

function subject(body: string, recordsPerInsert = 2) {
  const fake = makeFakeRepo();
  const httpService = { get: jest.fn(() => of({ data: body })) } as any;
  const service = new TransgeneService(
    { zfinTransgeneUrl: URL, recordsPerInsert } as any,
    fake.repo,
    httpService,
  );
  jest.spyOn(service['logger'], 'log').mockImplementation();
  return { service, fake, httpService };
}

describe('TransgeneService.loadFromZfin', () => {
  it('clears the table, then inserts the parsed rows', async () => {
    const { service, fake } = subject(
      [row('ZDB-ALT-1', 'a1'), row('ZDB-ALT-2', 'a2')].join('\n'),
      10,
    );
    await service.loadFromZfin();
    expect(fake.ops[0].type).toBe('delete');
    expect(
      fake
        .batches()
        .flat()
        .map((t: any) => t.alleleName),
    ).toEqual(['a1', 'a2']);
  });

  // A transgene that is also a mutation gets two lines; only the construct line is ours.
  it('keeps the construct line and ignores the companion gene line', async () => {
    const { service, fake } = subject(
      [
        row('ZDB-ALT-1', 'y1Tg', 'ZDB-TGCONSTRCT-070117-94'),
        row('ZDB-ALT-1', 'y1Tg', 'ZDB-GENE-980526-166'),
      ].join('\n'),
      10,
    );
    await service.loadFromZfin();
    expect(fake.batches().flat()).toHaveLength(1);
    expect((fake.batches().flat()[0] as any).zfinConstructId).toBe(
      'ZDB-TGCONSTRCT-070117-94',
    );
  });

  it('splits into batches and keeps the remainder', async () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      row(`ZDB-ALT-${i}`, `a${i}`),
    );
    const { service, fake } = subject(rows.join('\n'), 2);
    await service.loadFromZfin();
    expect(fake.batches().map((b) => b.length)).toEqual([2, 2, 1]);
  });

  it('throws and leaves the table alone when nothing parses', async () => {
    const { service, fake } = subject('<html><body>503</body></html>\n');
    await expect(service.loadFromZfin()).rejects.toThrow(
      /produced no usable records/,
    );
    expect(fake.deletes()).toBe(0);
  });
});

describe('TransgeneService.findByAlleleName', () => {
  it('looks the allele up by name', async () => {
    const { service, fake } = subject('', 10);
    await service.findByAlleleName('y1Tg');
    expect(fake.repo.findOne).toHaveBeenCalledWith({
      where: { alleleName: 'y1Tg' },
    });
  });
});
