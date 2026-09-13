import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';

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
   * AWAITED END TO END. This used to return the moment the HTTP request was issued, doing the real
   * work inside a .subscribe() callback that nothing waited on and whose errors went nowhere. The
   * caller — the nightly loader — compensated by sleeping 60 seconds and hoping. Now the promise
   * resolves when the data is actually in the table, and a failure propagates to a caller that can
   * report it.
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

    await this.repo
      .createQueryBuilder()
      .delete()
      .from(Mutation)
      .where('1')
      .execute();

    // The INSERT query can get huge, so we do a limited number of rows at a time.
    const batchSize = this.configService.recordsPerInsert;
    for (let i = 0; i < mutations.length; i += batchSize) {
      await this.insert(mutations.slice(i, i + batchSize));
    }

    const message = `Done mutation load from ${url}: ${mutations.length} mutations`;
    this.logger.log(message);
    return message;
  }

  async insert(mutations: Mutation[]): Promise<boolean> {
    await this.repo
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
