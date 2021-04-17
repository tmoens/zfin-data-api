import { HttpModule, Module } from "@nestjs/common";
import { MutationService } from './mutation.service';
import { MutationController } from './mutation.controller';
import { TypeOrmModule } from "@nestjs/typeorm";
import { Mutation } from "./entities/mutation.entity";

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([Mutation]),
  ],
  controllers: [MutationController],
  providers: [MutationService]
})
export class MutationModule {}
