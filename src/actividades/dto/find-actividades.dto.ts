import { IsBoolean, IsISO8601, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { ToBoolean } from '../../common/transforms/to-boolean.transform.js';

/**
 * Query params de GET /api/actividades.
 * Hereda search, limit y offset de PaginationDto.
 *
 * @example GET /actividades?desde=2026-10-01&hasta=2026-12-31&distrito=Biobío&search=retiro
 */
export class FindActividadesDto extends PaginationDto {

    // Actividades que siguen vigentes desde esta fecha
    /** Fecha ISO. Incluye las que empezaron antes pero terminan después de esta fecha. */
    @IsISO8601()
    @IsOptional()
    desde?: string;

    // Actividades que empiezan hasta esta fecha
    /** Fecha ISO. */
    @IsISO8601()
    @IsOptional()
    hasta?: string;

    // "Nacional" devuelve solo las nacionales
    /** Distrito exacto, sin distinguir mayúsculas ni tildes. */
    @IsString()
    @IsOptional()
    distrito?: string;

    // Solo para el panel: ?isActive=false lista las desactivadas. Los visitantes siempre ven las activas
    /** Por defecto true. El servicio lo ignora si quien consulta no gestiona actividades. */
    @ToBoolean()
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
