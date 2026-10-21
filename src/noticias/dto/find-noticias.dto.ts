import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { NoticiaCategoria } from '../interfaces/categoria.enum.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { ToBoolean } from '../../common/transforms/to-boolean.transform.js';

/**
 * Query params de GET /api/noticias.
 * Hereda search, limit y offset de PaginationDto.
 *
 * @example GET /noticias?publicado=true&categoria=Oración&search=aniversario&limit=10
 */
export class FindNoticiasDto extends PaginationDto {

    /** Solo panel: false lista los borradores. El servicio lo ignora para visitantes. */
    @ToBoolean()
    @IsBoolean()
    @IsOptional()
    publicado?: boolean;

    // Solo para el panel: ?isActive=false lista las desactivadas, para reactivarlas
    /** Por defecto true. El servicio lo ignora si quien consulta no gestiona noticias. */
    @ToBoolean()
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;

    /** Filtra por una categoría de NoticiaCategoria. */
    @IsEnum(NoticiaCategoria)
    @IsOptional()
    categoria?: NoticiaCategoria;

    // Solo para el panel: ?pendientes=true lista los que tienen datos por completar (ver "pendientes")
    /** El servicio lo ignora si quien consulta no gestiona noticias. */
    @ToBoolean()
    @IsBoolean()
    @IsOptional()
    pendientes?: boolean;
}
