import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The starting schema: the two tables this API serves.
 *
 * A deployment starts from an empty database and runs this, then the loader. Every row in these
 * tables is re-derived from zfin.org nightly, so there is no data that has to survive a move.
 * `synchronize` is off; schema changes are versioned migrations only.
 *
 * Both tables are keyed by the ZFIN Id and indexed on the allele name, which is the only column
 * anything ever searches. utf8mb4 is stated explicitly rather than inherited from the server
 * default, so the tables are the same on a local container and on DO Managed MySQL whatever those
 * servers happen to be configured with.
 */

export class InitialSchema1789271662463 implements MigrationInterface {
  name = 'InitialSchema1789271662463';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`mutation\` (\`zfinId\` varchar(255) NOT NULL COMMENT 'ZFIN Id for this mutation (Genomic Feature ID).', \`alleleName\` varchar(255) NOT NULL COMMENT 'Allele name. ZFIN calls this Genomic Feature Abbreviation. Users are familiar with this.', \`geneName\` varchar(255) NOT NULL COMMENT 'ZFIN calls this the "Gene Symbol". Users are familiar with this.', \`zfinGeneId\` varchar(255) NULL COMMENT 'ZFIN Id for the affected gene.', \`mutationType\` varchar(255) NULL COMMENT 'ZFIN field is called "Feature Type"', \`consequence\` varchar(255) NULL COMMENT 'What is the consequence of the mutation? ZFIN field is called "Transcript Consequence"', INDEX \`IDX_mutation_alleleName\` (\`alleleName\`), PRIMARY KEY (\`zfinId\`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
    );
    await queryRunner.query(
      `CREATE TABLE \`transgene\` (\`zfinId\` varchar(255) NOT NULL COMMENT 'ZFIN Id for this transgene (Genomic Feature ID).', \`alleleName\` varchar(255) NOT NULL COMMENT 'Allele name. ZFIN calls this Genomic Feature Abbreviation. Users are familiar with this.', \`zfinConstructId\` varchar(255) NOT NULL COMMENT 'ZFIN Id for the transgene construct.', \`zfinConstructName\` varchar(255) NOT NULL COMMENT 'ZFIN name for the transgene construct.', INDEX \`IDX_transgene_alleleName\` (\`alleleName\`), PRIMARY KEY (\`zfinId\`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`IDX_transgene_alleleName\` ON \`transgene\``,
    );
    await queryRunner.query(`DROP TABLE \`transgene\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_mutation_alleleName\` ON \`mutation\``,
    );
    await queryRunner.query(`DROP TABLE \`mutation\``);
  }
}
