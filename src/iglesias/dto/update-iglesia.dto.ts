import { PartialType } from '@nestjs/mapped-types';
import { CreateIglesiaDto } from './create-iglesia.dto.js';

export class UpdateIglesiaDto extends PartialType(CreateIglesiaDto) {}
