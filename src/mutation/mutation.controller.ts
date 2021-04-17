import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { MutationService } from './mutation.service';
import { CreateMutationDto } from './dto/create-mutation.dto';
import { UpdateMutationDto } from './dto/update-mutation.dto';

@Controller('mutation')
export class MutationController {
  constructor(private readonly mutationService: MutationService) {}

  // trigger loading from zfin - for testing
  @Get('loadFromZfin')
  async loadFromZfin(): Promise<any> {
    return this.mutationService.loadFromZfin();
  }

  @Get('allele/:alleleName')
  findByAlleleName(@Param('alleleName') alleleName: string) {
    return this.mutationService.findByAlleleName(alleleName);
  }

}
