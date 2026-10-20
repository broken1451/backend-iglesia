import { PartialType } from '@nestjs/mapped-types';
import { CreateIglesiaDto } from './create-iglesia.dto.js';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * Body de PATCH /api/iglesias/:id.
 * PartialType copia todos los campos de CreateIglesiaDto con sus validaciones,
 * pero opcionales: se envía solo lo que se quiere cambiar.
 */
export class UpdateIglesiaDto extends PartialType(CreateIglesiaDto) {

    /** true reactiva una iglesia desactivada; false la desactiva (igual que DELETE). */
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
