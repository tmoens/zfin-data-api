import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity()
export class Mutation {
  @PrimaryColumn({
    comment: 'ZFIN Id for this mutation (Genomic Feature ID).',
  })
  zfinId: string;

  // INDEXED because this is the only question the API is ever asked. Every request is
  // findOne({where: {alleleName}}), and without an index that is a full scan of ~50,000 rows on
  // every single lookup, for a table that is written once a night and read all day.
  @Index('IDX_mutation_alleleName')
  @Column({
    comment:
      'Allele name. ZFIN calls this Genomic Feature Abbreviation. Users are familiar with this.',
  })
  alleleName: string;

  @Column({
    comment: 'ZFIN calls this the "Gene Symbol". Users are familiar with this.',
  })
  geneName: string;

  @Column({
    nullable: true,
    comment: 'ZFIN Id for the affected gene.',
  })
  zfinGeneId: string;

  @Column({
    nullable: true,
    comment: 'ZFIN field is called "Feature Type"',
  })
  mutationType: string;

  @Column({
    nullable: true,
    comment:
      'What is the consequence of the mutation? ZFIN field is called "Transcript Consequence"',
  })
  consequence: string;

  constructor(
    zfinId: string,
    alleleName: string,
    geneName: string,
    zfinGeneId: string,
    mutationType: string,
    consequence: string,
  ) {
    this.zfinId = zfinId;
    this.alleleName = alleleName;
    this.geneName = geneName;
    this.mutationType = mutationType;
    this.consequence = consequence;
    this.zfinGeneId = zfinGeneId;
  }
}
