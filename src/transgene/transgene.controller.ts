import { Controller, Get, Param, Inject, Logger } from '@nestjs/common';
import { TransgeneService } from './transgene.service';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

@Controller('transgene')
export class TransgeneController {
  constructor(
    private configService: ConfigService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: Logger,
    private readonly transgeneService: TransgeneService,
    ) {}

  // trigger loading from zfin - for testing
  @Get('loadFromZfin')
  async loadFromZfin(): Promise<any> {
    if (!(this.configService.get('ALLOW_LOADING_VIA_API') === 'true')) {
      this.logger.log(`Attempt to load transgene data using the API when that function is disabled.`);
      return 'Disabled';
    }
    return this.transgeneService.loadFromZfin();
  }

  @Get('allele/:alleleName')
  findByAlleleName(@Param('alleleName') alleleName: string) {
    return this.transgeneService.findByAlleleName(alleleName);
  }
}
