import { PartialType } from '@nestjs/mapped-types';
import { ArrayUnique, IsArray, IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { CreateAuthDto } from './create-auth.dto.js';
import { ValidRoles } from '../interfaces/role.enum.js';

/**
 * Body de PATCH /api/auth/:id (solo ADMIN).
 *
 * PartialType copia todos los campos del registro (name, last_name, email, password)
 * con sus validaciones, pero opcionales. Además agrega lo que solo un ADMIN puede cambiar.
 */
export class UpdateAuthDto extends PartialType(CreateAuthDto) {

    /**
     * Reemplaza TODOS los roles del usuario (no se suman a los que tenía).
     * Solo valores de ValidRoles y sin repetir.
     * @example ["DISTRITO", "COMUNICACIONES"]
     */
    @IsArray()
    @ArrayUnique()
    @IsEnum(ValidRoles, { each: true })
    @IsOptional()
    roles?: ValidRoles[];

    /** false desactiva al usuario (sus tokens dejan de servir); true lo reactiva. */
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
