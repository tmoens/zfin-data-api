import { HttpService, Inject, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Mutation } from "./mutation.entity";
import { ZfinMutationRecord } from "./zfin-mutation-record";
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class MutationService {

  constructor(
    private configService: ConfigService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: Logger,
    @InjectRepository(Mutation)
    private readonly repo: Repository<Mutation>,
    private readonly httpService: HttpService,
  ) {}

  findByAlleleName(alleleName: string) {
    return this.repo.findOne({where: {alleleName}});
  }

  async loadFromZfin(): Promise<any> {
    if (!this.configService.get('ALLOW_LOADING_VIA_API')) {
      this.logger.log(`Attempt to load mutation data using the API when that function is disabled.`);
      return 'Disabled';
    }
    this.logger.log(`Starting mutation load from ${this.configService.get("ZFIN_MUTATION_URL")}`);
    this.httpService.get(this.configService.get("ZFIN_MUTATION_URL")).subscribe(async (response) => {

      // records are separated by \n so split them up
      const records: string[] = response.data.split('\n');

      // Convert records first into ZfinMutationRecords which mirror the file content exactly.
      // Filter out the "Deficiencies" and "Translocations" in the file.
      // Create Mutation objects for insertion.
      const mutations: Mutation[] = records.reduce((muts: Mutation[], record: string, index: number, records) => {
        const mutationRecord: ZfinMutationRecord = new ZfinMutationRecord(...record.split('\t'));
        if (!mutationRecord.isDeficiencyOrTranslocation()) {
          muts.push(mutationRecord.convertToMutation());
        }
        return muts;
      }, []);

      await this.repo.createQueryBuilder()
        .delete()
        .from(Mutation)
        .where("1")
        .execute();

      // the INSERT query can get huge so we do a limited number of lines at a time
      const count = 0;
      let inserts: Mutation[] = [];
      for (let i = 0; i < mutations.length; i++) {
        inserts.push(mutations[i]);
        if (inserts.length === Number(this.configService.get("RECORDS_PER_INSERT"))) {
          await this.insert(inserts);
          inserts = [];
        }
      }
      // do the remainder.
      await this.insert(inserts);
      this.logger.log(`Done mutation load from ${this.configService.get("ZFIN_MUTATION_URL")}`);

    });
    return 'Triggered mutation loading from ZFIN';
  }

  async insert(mutations: Mutation[]): Promise<boolean> {
    const result = await this.repo.createQueryBuilder()
      .insert()
      .into(Mutation)
      .orIgnore()
      .values(
        mutations.map((t: Mutation) => {
          return t;
        })
      )
      .execute();
    this.logger.log(`Inserted ${mutations.length} mutations`);
    return true;
  }
}
