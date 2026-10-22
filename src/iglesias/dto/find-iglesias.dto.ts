import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { ToBoolean } from '../../common/transforms/to-boolean.transform.js';

/**
 * Query params de GET /api/iglesias.
 * Hereda search, limit y offset de PaginationDto.
 *
 * @example GET /iglesias?distrito=Norte&search=central&limit=20&offset=0
 */
export class FindIglesiasDto extends PaginationDto {

    /** Distrito exacto: el id del selector ("araucania") o el nombre, sin distinguir mayúsculas ni tildes. */
    @IsString()
    @IsOptional()
    distrito?: string;

    // Solo para el panel: ?isActive=false lista las desactivadas. Los visitantes siempre ven las activas
    /** Por defecto true. El servicio lo ignora si quien consulta no gestiona iglesias. */
    @ToBoolean()
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;

    // Solo para el panel: ?pendientes=true lista las fichas incompletas; ?pendientes=false, las completas
    /** El servicio lo ignora si quien consulta no gestiona iglesias. */
    @ToBoolean()
    @IsBoolean()
    @IsOptional()
    pendientes?: boolean;
}
