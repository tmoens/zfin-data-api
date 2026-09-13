import { Controller, Get, Logger, Param } from '@nestjs/common';

import { ConfigService } from '../config/config.service';
import { MutationService } from './mutation.service';

@Controller('mutation')
export class MutationController {
  private readonly logger = new Logger(MutationController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly mutationService: MutationService,
  ) {}

  // Trigger loading from ZFIN — for development. Off unless the deployment env says otherwise,
  // because the route has no authentication: see ALLOW_LOADING_VIA_API in the config schema.
  @Get('loadFromZfin')
  async loadFromZfin(): Promise<string> {
    if (!this.configService.allowLoadingViaApi) {
      this.logger.warn(
        'Attempt to load mutation data using the API when that function is disabled.',
      );
      return 'Disabled';
    }
    return this.mutationService.loadFromZfin();
  }

  @Get('allele/:alleleName')
  findByAlleleName(@Param('alleleName') alleleName: string) {
    return this.mutationService.findByAlleleName(alleleName);
  }
}
