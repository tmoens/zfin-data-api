import { Controller, Get, Logger, Param } from '@nestjs/common';

import { ConfigService } from '../config/config.service';
import { TransgeneService } from './transgene.service';

@Controller('transgene')
export class TransgeneController {
  private readonly logger = new Logger(TransgeneController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly transgeneService: TransgeneService,
  ) {}

  // See MutationController.loadFromZfin.
  @Get('loadFromZfin')
  async loadFromZfin(): Promise<string> {
    if (!this.configService.allowLoadingViaApi) {
      this.logger.warn(
        'Attempt to load transgene data using the API when that function is disabled.',
      );
      return 'Disabled';
    }
    return this.transgeneService.loadFromZfin();
  }

  @Get('allele/:alleleName')
  findByAlleleName(@Param('alleleName') alleleName: string) {
    return this.transgeneService.findByAlleleName(alleleName);
  }
}
