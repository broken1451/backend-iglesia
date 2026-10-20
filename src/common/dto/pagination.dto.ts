import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Query params comunes a todos los listados: ?search=texto&limit=20&offset=0
 *
 * Los DTO de filtros de cada módulo (FindIglesiasDto, FindActividadesDto, FindNoticiasDto)
 * extienden de este y le suman sus propios filtros.
 */
export class PaginationDto {

    /** Busca en el campo principal (nombre o título), sin distinguir mayúsculas ni tildes. */
    @IsString()
    @IsOptional()
    search?: string;

    /**
     * Cuántos resultados devolver. Por defecto 20 (lo pone el servicio).
     * Máximo 100, para que nadie pueda pedir la base completa en un solo request.
     * @Type convierte el texto de la URL ("20") a número antes de validar.
     */
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    @IsOptional()
    limit?: number;

    /** Cuántos resultados saltar. Página 2 con limit 20 → offset=20. Por defecto 0. */
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @IsOptional()
    offset?: number;
}
