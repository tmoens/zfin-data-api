import { ZfinTransgeneRecord } from './zfin-transgene-record';

const fromLine = (line: string) => new ZfinTransgeneRecord(...line.split('\t'));

// Field order: 0 Genomic Feature ID, 1 Abbreviation, 2 Name, 3 Feature SO ID,
//              4 Construct ID, 5 Construct Name, 6 Construct SO ID
const line = (id: string, abbrev: string, constructId: string) =>
  [
    id,
    abbrev,
    'name',
    'SO:0000804',
    constructId,
    'Tg(fli1:EGFP)',
    'SO:0000804',
  ].join('\t');

describe('ZfinTransgeneRecord.isConstruct', () => {
  it('accepts a line carrying a transgene construct', () => {
    expect(
      fromLine(
        line('ZDB-ALT-011017-8', 'y1Tg', 'ZDB-TGCONSTRCT-070117-94'),
      ).isConstruct(),
    ).toBe(true);
  });

  // Some transgenes are sort of a mutation, and get two lines in the file — one for the construct
  // and one for the mutated gene. Only the construct line is ours.
  it('ignores the companion line for the mutated gene', () => {
    expect(
      fromLine(
        line('ZDB-ALT-011017-8', 'y1Tg', 'ZDB-GENE-980526-166'),
      ).isConstruct(),
    ).toBe(false);
  });

  it('rejects the trailing blank line, and a header row if one ever appears', () => {
    expect(fromLine('Genomic Feature ID\tAbbreviation').isConstruct()).toBe(
      false,
    );
    expect(fromLine('').isConstruct()).toBe(false);
  });

  it('carries the fields across to the entity in the right order', () => {
    const t = fromLine(
      line('ZDB-ALT-011017-8', 'y1Tg', 'ZDB-TGCONSTRCT-070117-94'),
    ).convertToTransgene();
    expect(t.zfinId).toBe('ZDB-ALT-011017-8');
    expect(t.alleleName).toBe('y1Tg');
    expect(t.zfinConstructId).toBe('ZDB-TGCONSTRCT-070117-94');
    expect(t.zfinConstructName).toBe('Tg(fli1:EGFP)');
  });
});
