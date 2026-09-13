import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';

import { ConfigService } from '../config/config.service';
import { Transgene } from './transgene.entity';
import { ZfinTransgeneRecord } from './zfin-transgene-record';

@Injectable()
export class TransgeneService {
  private readonly logger = new Logger(TransgeneService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Transgene)
    private readonly repo: Repository<Transgene>,
    private readonly httpService: HttpService,
  ) {}

  findByAlleleName(alleleName: string) {
    return this.repo.findOne({ where: { alleleName } });
  }

  /**
   * Replace the transgene table with the current contents of the ZFIN download.
   *
   * See MutationService.loadFromZfin — same shape, same reasons.
   */
  async loadFromZfin(): Promise<string> {
    const url = this.configService.zfinTransgeneUrl;
    this.logger.log(`Starting transgene load from ${url}`);

    const response = await firstValueFrom(
      this.httpService.get(url, { responseType: 'text' }),
    );

    // Some transgenes are sort of a mutation. For those there are two records in the tgInsertions
    // file — one for the tg construct and one for the mutated gene. isConstruct() keeps the
    // construct line and ignores the gene line.
    const records: string[] = String(response.data).split('\n');
    const transgenes: Transgene[] = records.reduce(
      (tgs: Transgene[], record: string) => {
        const tgRecord = new ZfinTransgeneRecord(...record.split('\t'));
        if (tgRecord.isConstruct()) {
          tgs.push(tgRecord.convertToTransgene());
        }
        return tgs;
      },
      [],
    );

    // See the matching guard in MutationService: an empty parse means the download was not what we
    // expected, and yesterday's rows beat no rows.
    if (transgenes.length === 0) {
      throw new Error(
        `Transgene load from ${url} produced no usable records (${records.length} lines read); ` +
          'leaving the existing data in place.',
      );
    }

    await this.repo
      .createQueryBuilder()
      .delete()
      .from(Transgene)
      .where('1')
      .execute();

    const batchSize = this.configService.recordsPerInsert;
    for (let i = 0; i < transgenes.length; i += batchSize) {
      await this.insert(transgenes.slice(i, i + batchSize));
    }

    const message = `Done transgene load from ${url}: ${transgenes.length} transgenes`;
    this.logger.log(message);
    return message;
  }

  async insert(tgs: Transgene[]): Promise<boolean> {
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(Transgene)
      .orIgnore()
      .values(tgs)
      .execute();
    this.logger.log(`Inserted ${tgs.length} transgenes`);
    return true;
  }
}
