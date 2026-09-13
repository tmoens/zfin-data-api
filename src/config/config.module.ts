import { Global, Module } from '@nestjs/common';

import { ConfigService } from './config.service';

@Global()
@Module({
  providers: [
    {
      provide: ConfigService,
      useFactory: () => new ConfigService(), // Use a factory to defer instantiation
    },
  ],
  exports: [ConfigService],
})
export class ConfigModule {}
