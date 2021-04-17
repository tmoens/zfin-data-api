import { PartialType } from '@nestjs/mapped-types';
import { CreateTransgeneDto } from './create-transgene.dto';

export class UpdateTransgeneDto extends PartialType(CreateTransgeneDto) {}
