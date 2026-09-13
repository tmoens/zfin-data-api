import { Injectable } from '@nestjs/common';

import { ConfigService } from './config/config.service';

@Injectable()
export class AppService {
  constructor(private readonly configService: ConfigService) {}

  getHello(): string {
    const base = this.configService.publicUrl;
    const message: string[] = [
      'This API fills a need that the APIs at ZFIN.org do not presently fulfill. ' +
        'Given a zebrafish mutation or transgene allele name, it will supply the ZFIN Id of that ' +
        'mutation or allele. The supported calls are:',
      `${base}/mutation/allele/your_mutation_allele_here`,
      `${base}/transgene/allele/your_transgene_allele_here`,
      `${base}/health`,
      'In future there may be other functions such as mutation/search/some_search_critieria_here',
    ];

    return message.join('</p><p>');
  }
}
