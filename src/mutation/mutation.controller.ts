import { Controller, Get, Param, Inject, Logger } from '@nestjs/common';
import { MutationService } from './mutation.service';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

@Controller('mutation')
export class MutationController {
  constructor(
    private configService: ConfigService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: Logger,
    private readonly mutationService: MutationService,
  ) {}

  // trigger loading from zfin - for testing
  @Get('loadFromZfin')
  async loadFromZfin(): Promise<any> {
    if (!(this.configService.get('ALLOW_LOADING_VIA_API') === 'true')) {
      this.logger.log(`Attempt to load mutation data using the API when that function is disabled.`);
      return 'Disabled';
    }
    return this.mutationService.loadFromZfin();
  }

  @Get('allele/:alleleName')
  findByAlleleName(@Param('alleleName') alleleName: string) {
    return this.mutationService.findByAlleleName(alleleName);
  }
}

