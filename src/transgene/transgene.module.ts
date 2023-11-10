import { Module } from '@nestjs/common';
import { TransgeneService } from './transgene.service';
import { TransgeneController } from './transgene.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transgene } from './transgene.entity';
import {HttpModule} from '@nestjs/axios';

@Module({
  imports:[
    HttpModule,
    TypeOrmModule.forFeature([Transgene]),
  ],
  controllers: [TransgeneController],
  providers: [TransgeneService]
})
export class TransgeneModule {}
