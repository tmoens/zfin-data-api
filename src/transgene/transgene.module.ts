import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TransgeneController } from './transgene.controller';
import { Transgene } from './transgene.entity';
import { TransgeneService } from './transgene.service';

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([Transgene])],
  controllers: [TransgeneController],
  providers: [TransgeneService],
})
export class TransgeneModule {}
