import { HttpModule, Module } from "@nestjs/common";
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TransgeneModule } from "./transgene/transgene.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Transgene } from "./transgene/entities/transgene.entity";
import { MutationModule } from './mutation/mutation.module';
import { Mutation } from "./mutation/entities/mutation.entity";

import * as winston from "winston";
import * as DailyRotateFile from "winston-daily-rotate-file";
import {utilities as nestWinstonModuleUtilities, WinstonModule} from 'nest-winston';

const rotatingFileLog = new DailyRotateFile({
  filename: 'zf-%DATE%.log',
  datePattern: 'YYYY-MM-DD-HH',
  dirname: 'log',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d'
});

const consoleLog = new (winston.transports.Console)({
  format: winston.format.combine(
    winston.format.timestamp(),
    nestWinstonModuleUtilities.format.nestLike(),
  ),
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.development.env'],
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        username: configService.get('DATABASE_USER'),
        password: configService.get('DATABASE_PASSWORD'),
        database: configService.get('DATABASE_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: true,
      }),
      inject: [ConfigService],
    }),

    WinstonModule.forRoot({
      transports: [
        consoleLog,
        rotatingFileLog,
      ],
      // other options
    }),
    TransgeneModule,
    MutationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})

export class AppModule {}

