import { PartialType } from '@nestjs/mapped-types';
import { CreateMutationDto } from './create-mutation.dto';

export class UpdateMutationDto extends PartialType(CreateMutationDto) {}
