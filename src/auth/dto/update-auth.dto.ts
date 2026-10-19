import { PartialType } from '@nestjs/mapped-types';
import { ArrayUnique, IsArray, IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { CreateAuthDto } from './create-auth.dto.js';
import { ValidRoles } from '../interfaces/role.enum.js';

export class UpdateAuthDto extends PartialType(CreateAuthDto) {

    @IsArray()
    @ArrayUnique()
    @IsEnum(ValidRoles, { each: true })
    @IsOptional()
    roles?: ValidRoles[];

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
