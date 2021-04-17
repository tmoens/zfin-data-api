import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { TransgeneService } from './transgene.service';
import { CreateTransgeneDto } from './dto/create-transgene.dto';
import { UpdateTransgeneDto } from './dto/update-transgene.dto';

@Controller('transgene')
export class TransgeneController {
  constructor(private readonly transgeneService: TransgeneService) {}

  // trigger loading from zfin - for testing
  @Get('loadFromZfin')
  async loadFromZfin(): Promise<any> {
    return this.transgeneService.loadFromZfin();
  }

  @Get('allele/:alleleName')
  findByAlleleName(@Param('alleleName') alleleName: string) {
    return this.transgeneService.findByAlleleName(alleleName);
  }
}