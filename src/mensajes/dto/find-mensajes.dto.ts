import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { ToBoolean } from '../../common/transforms/to-boolean.transform.js';

/**
 * Query params de GET /api/mensajes.
 * Hereda search (nombre, correo o asunto), limit y offset de PaginationDto.
 *
 * @example GET /mensajes?leido=false&limit=10
 */
export class FindMensajesDto extends PaginationDto {

    /** false = solo los sin leer; true = solo los leídos. Sin enviar: todos. */
    @ToBoolean()
    @IsBoolean()
    @IsOptional()
    leido?: boolean;

    /** false lista los archivados. Por defecto true. */
    @ToBoolean()
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
