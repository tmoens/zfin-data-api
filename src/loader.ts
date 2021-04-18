import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";
import { ConfigService } from "@nestjs/config";
import { MutationService } from "./mutation/mutation.service";
import { TransgeneService } from "./transgene/transgene.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  const transgeneService = app.get(TransgeneService);
  const mutationService = app.get(MutationService);

  await transgeneService.loadFromZfin();
  await mutationService.loadFromZfin();

  /* This is not a persistent service, so let's exit */
  process.exit();
}
bootstrap();
