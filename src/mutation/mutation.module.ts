import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MutationController } from './mutation.controller';
import { Mutation } from './mutation.entity';
import { MutationService } from './mutation.service';

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([Mutation])],
  controllers: [MutationController],
  providers: [MutationService],
})
export class MutationModule {}
