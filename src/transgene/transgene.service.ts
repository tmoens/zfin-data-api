import { HttpService, Inject, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Mutation } from "../mutation/mutation.entity";
import { Repository } from "typeorm";
import { Transgene } from "./transgene.entity";
import { ZfinTransgeneRecord } from "./zfin-transgene-record";
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class TransgeneService {
  constructor(
    private configService: ConfigService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: Logger,
    @InjectRepository(Transgene)
    private repo: Repository<Transgene>,
    private readonly httpService: HttpService,
  ) {}


  findByAlleleName(alleleName: string) {
    return this.repo.findOne({where: {alleleName}});
  }

  /**
   * - get a file of transgens from ZFIN
   */
  async loadFromZfin(): Promise<any> {
    this.logger.log(`Starting transgene load from ${this.configService.get("ZFIN_TRANSGENE_URL")}`);

    // get the transgenes from ZFIN
    this.httpService.get(this.configService.get("ZFIN_TRANSGENE_URL"))
      .subscribe(async (response) => {

        // records are separated by \n so split them up
        const records: string[] = response.data.split('\n');

        // Convert records first into ZfinTransgenRecords which mirror the file content exactly.
        // Turns out some transgenes are sort of mutation.  For those, there are
        // two records in the tgInsertions file.  One for the tg construct
        // and one for the mutated gene.  Ignore the line for the gene
        // Then convert to a Transgene object for putting in the database
        const transgenes: Transgene[] = records.reduce((tgs: Transgene[], record: string, index: number, records) => {
          const tgRecord: ZfinTransgeneRecord = new ZfinTransgeneRecord(...record.split('\t'));
          if (tgRecord.isConstruct()) {
            tgs.push(tgRecord.convertToTransgene());
          }
          return tgs;
        }, []);

        // clear the current database table
        await this.repo.createQueryBuilder()
          .delete()
          .from(Transgene)
          .where("1")
          .execute();

        // the INSERT query can get huge so we do a limited number of lines at a time
        const count = 0;
        let inserts: Transgene[] = [];
        for (let i = 0; i < transgenes.length; i++) {
          inserts.push(transgenes[i]);
          if (inserts.length === Number(this.configService.get("RECORDS_PER_INSERT"))) {
            await this.insert(inserts);
            inserts = [];
          }
        }
        // do the remainder.
        await this.insert(inserts);
        this.logger.log(`Done transgene load from ${this.configService.get("ZFIN_TRANSGENE_URL")}`);
      });
    return 'allswellthatendswell';
  };

  async insert(tgs: Transgene[]): Promise<boolean> {
    const result = await this.repo.createQueryBuilder()
      .insert()
      .into(Transgene)
      .orIgnore()
      .values(
        tgs.map((t: Transgene) => {
          return t;
        })
      )
      .execute();
    this.logger.log(`Inserted ${tgs.length} transgenes`);
    return true;
  }
}


