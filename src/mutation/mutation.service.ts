import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { EntityManager, Repository } from 'typeorm';

import { ConfigService } from '../config/config.service';
import { Mutation } from './mutation.entity';
import { ZfinMutationRecord } from './zfin-mutation-record';

@Injectable()
export class MutationService {
  private readonly logger = new Logger(MutationService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Mutation)
    private readonly repo: Repository<Mutation>,
    private readonly httpService: HttpService,
  ) {}

  findByAlleleName(alleleName: string) {
    return this.repo.findOne({ where: { alleleName } });
  }

  /**
   * Replace the mutation table with the current contents of the ZFIN download.
   *
   * Awaited end to end: the promise resolves when the data is in the table, and any failure
   * propagates to the caller rather than being swallowed.
   */
  async loadFromZfin(): Promise<string> {
    const url = this.configService.zfinMutationUrl;
    this.logger.log(`Starting mutation load from ${url}`);

    const response = await firstValueFrom(
      this.httpService.get(url, { responseType: 'text' }),
    );

    // Records are separated by \n so split them up. Convert to ZfinMutationRecords which mirror the
    // file content exactly, drop anything that isn't a usable mutation, and build Mutation rows.
    const records: string[] = String(response.data).split('\n');
    const mutations: Mutation[] = records.reduce(
      (muts: Mutation[], record: string) => {
        const mutationRecord = new ZfinMutationRecord(...record.split('\t'));
        if (mutationRecord.isLoadable()) {
          muts.push(mutationRecord.convertToMutation());
        }
        return muts;
      },
      [],
    );

    // REFUSE TO WIPE THE TABLE OVER NOTHING. The delete below is unconditional and the insert that
    // follows is not transactional, so an empty parse would leave the API answering nothing at all
    // until the next night. ZFIN serving an HTML error page with a 200 lands exactly here: every
    // line fails isLoadable(), and without this guard a readable outage upstream becomes a data
    // outage here. The existing rows are yesterday's truth, which is worth far more than none.
    if (mutations.length === 0) {
      throw new Error(
        `Mutation load from ${url} produced no usable records (${records.length} lines read); ` +
          'leaving the existing data in place.',
      );
    }

    // ONE TRANSACTION, because the refill empties the table first. Outside a transaction there is a
    // stretch — the whole refill — when the table is empty or half full, and a lookup during it
    // answers "ZFIN has never heard of this allele" about every allele there is. That answer is
    // indistinguishable from the truth, so it is believed. Inside a transaction a reader sees
    // yesterday's complete data until the moment it sees today's.
    //
    // The clear has to stay a DELETE. TRUNCATE empties the table far faster and is the obvious
    // tidy-up here, but it is DDL: MySQL commits the transaction around it, and the window this
    // transaction exists to close reopens.
    await this.repo.manager.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .delete()
        .from(Mutation)
        .where('1')
        .execute();

      // The INSERT query can get huge, so we do a limited number of rows at a time.
      const batchSize = this.configService.recordsPerInsert;
      for (let i = 0; i < mutations.length; i += batchSize) {
        await this.insert(mutations.slice(i, i + batchSize), manager);
      }
    });

    const message = `Done mutation load from ${url}: ${mutations.length} mutations`;
    this.logger.log(message);
    return message;
  }

  /** One batch. `manager` keeps the write inside the caller's transaction where there is one. */
  async insert(
    mutations: Mutation[],
    manager: EntityManager = this.repo.manager,
  ): Promise<boolean> {
    await manager
      .createQueryBuilder()
      .insert()
      .into(Mutation)
      .orIgnore()
      .values(mutations)
      .execute();
    this.logger.log(`Inserted ${mutations.length} mutations`);
    return true;
  }
}
