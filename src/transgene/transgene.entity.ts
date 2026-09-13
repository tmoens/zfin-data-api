import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity()
export class Transgene {
  @PrimaryColumn({
    comment: 'ZFIN Id for this transgene (Genomic Feature ID).',
  })
  zfinId: string;

  // Indexed for the same reason as Mutation.alleleName — it is the lookup key.
  @Index('IDX_transgene_alleleName')
  @Column({
    comment:
      'Allele name. ZFIN calls this Genomic Feature Abbreviation. Users are familiar with this.',
  })
  alleleName: string;

  @Column({
    comment: 'ZFIN Id for the transgene construct.',
  })
  zfinConstructId: string;

  @Column({
    comment: 'ZFIN name for the transgene construct.',
  })
  zfinConstructName: string;

  constructor(
    zfinId: string,
    alleleName: string,
    zfinConstructId: string,
    zfinConstructName: string,
  ) {
    this.zfinId = zfinId;
    this.alleleName = alleleName;
    this.zfinConstructId = zfinConstructId;
    this.zfinConstructName = zfinConstructName;
  }
}
