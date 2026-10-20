import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateNoticiaDto } from './create-noticia.dto.js';

/**
 * Body de PATCH /api/noticias/:id.
 * PartialType copia todos los campos de CreateNoticiaDto con sus validaciones,
 * pero opcionales: se envía solo lo que se quiere cambiar.
 */
export class UpdateNoticiaDto extends PartialType(CreateNoticiaDto) {

    /** true reactiva una noticia desactivada; false la desactiva (igual que DELETE). */
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
