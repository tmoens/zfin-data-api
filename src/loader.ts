import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { MutationService } from './mutation/mutation.service';
import { TransgeneService } from './transgene/transgene.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  const transgeneService: TransgeneService = app.get(TransgeneService);
  const mutationService: MutationService = app.get(MutationService);

  await transgeneService.loadFromZfin();
  await mutationService.loadFromZfin();

  await delay(60000);

  /* This is not a persistent service, so let's exit */
  process.exit();
}
bootstrap().then();

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
