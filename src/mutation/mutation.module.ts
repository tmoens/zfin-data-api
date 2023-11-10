import { Module } from '@nestjs/common';
import { MutationService } from './mutation.service';
import { MutationController } from './mutation.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Mutation } from './mutation.entity';
import {HttpModule} from '@nestjs/axios';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([Mutation]),
  ],
  controllers: [MutationController],
  providers: [MutationService]
})
export class MutationModule {}
