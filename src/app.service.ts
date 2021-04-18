import { Injectable } from "@nestjs/common";
import { Observable, of } from "rxjs";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class AppService {

  constructor(
    private configService: ConfigService,
  ) {
  }

  getHello(): string {
    const message: string[] = [];
    message.push('<p>This API fills a need that the APIs at ZFIN.org do not presently fulfill. ' +
      'Given a zebrafish mutation or transgene allele name, it will supply the ZFIN Id of that mutation or allele. ' +
      'The supported calls are:');
    message.push(`${this.configService.get('MY_URL')}/mutation/allele/your_mutation_allele_here`)
    message.push(`${this.configService.get('MY_URL')}/transgene/allele/your_transgene_allele_here`)
    message.push('In future there may be other functions such as mutation/search/some_search_critieria_here')

    return message.join('</p><p>');
  }
}
