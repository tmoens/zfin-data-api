import { ZfinMutationRecord } from './zfin-mutation-record';

/** Build a record from a tab-separated line, exactly as the service does. */
const fromLine = (line: string) => new ZfinMutationRecord(...line.split('\t'));

// Field order, from the top of zfin-mutation-record.ts:
//   0 Genomic Feature ID, 1 Feature SO ID, 2 Abbreviation, 3 Gene Symbol, 4 Gene ID,
//   5 Gene SO ID, 6 Relationship, 7 Feature Type, ...
const line = (id: string, abbrev: string, featureType: string) =>
  [
    id,
    'SO:1000008',
    abbrev,
    'lhfpl4a',
    'ZDB-GENE-111017-1',
    'SO:0000704',
    'is allele of',
    featureType,
  ].join('\t');

describe('ZfinMutationRecord.isLoadable', () => {
  it('accepts an ordinary point mutation', () => {
    expect(
      fromLine(
        line('ZDB-ALT-130411-2656', 'sa12986', 'POINT_MUTATION'),
      ).isLoadable(),
    ).toBe(true);
  });

  it('rejects deficiencies and translocations — not what this API answers for', () => {
    expect(fromLine(line('ZDB-ALT-1', 'df1', 'DEFICIENCY')).isLoadable()).toBe(
      false,
    );
    expect(fromLine(line('ZDB-ALT-2', 'tr1', 'TRANSLOC')).isLoadable()).toBe(
      false,
    );
  });

  // The current file has no header row; this guards against ZFIN adding one.
  it('rejects a header row, should ZFIN ever add one', () => {
    expect(
      fromLine(
        'Genomic Feature ID\tFeature SO ID\tGenomic Feature Abbreviation',
      ).isLoadable(),
    ).toBe(false);
  });

  // The file ends with a newline, so split('\n') yields a trailing empty element.
  it('rejects the trailing blank line', () => {
    expect(fromLine('').isLoadable()).toBe(false);
  });

  // This is what lets the service tell "ZFIN served us something that is not the file" apart from
  // "the file is legitimately empty", instead of wiping the table over an upstream outage.
  it('rejects an HTML error page served with a 200', () => {
    const html = [
      '<!DOCTYPE html>',
      '<html><head><title>503</title></head>',
      '</html>',
    ];
    expect(html.every((l) => !fromLine(l).isLoadable())).toBe(true);
  });

  it('rejects a row with an id but no allele name', () => {
    expect(fromLine(line('ZDB-ALT-3', '', 'POINT_MUTATION')).isLoadable()).toBe(
      false,
    );
  });

  it('carries the fields across to the entity in the right order', () => {
    const m = fromLine(
      line('ZDB-ALT-130411-2656', 'sa12986', 'POINT_MUTATION'),
    ).convertToMutation();
    expect(m.zfinId).toBe('ZDB-ALT-130411-2656');
    expect(m.alleleName).toBe('sa12986');
    expect(m.geneName).toBe('lhfpl4a');
    expect(m.zfinGeneId).toBe('ZDB-GENE-111017-1');
    expect(m.mutationType).toBe('POINT_MUTATION');
  });
});
