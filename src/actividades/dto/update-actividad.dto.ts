import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateActividadDto } from './create-actividad.dto.js';

/**
 * Body de PATCH /api/actividades/:id.
 * PartialType copia todos los campos de CreateActividadDto con sus validaciones,
 * pero opcionales: se envía solo lo que se quiere cambiar.
 */
export class UpdateActividadDto extends PartialType(CreateActividadDto) {

    /** true reactiva una actividad desactivada; false la desactiva (igual que DELETE). */
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
