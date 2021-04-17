import { HttpModule, Module } from "@nestjs/common";
import { TransgeneService } from './transgene.service';
import { TransgeneController } from './transgene.controller';
import { TypeOrmModule } from "@nestjs/typeorm";
import { Transgene } from "./entities/transgene.entity";

@Module({
  imports:[
    HttpModule,
    TypeOrmModule.forFeature([Transgene]),
  ],
  controllers: [TransgeneController],
  providers: [TransgeneService]
})
export class TransgeneModule {}
