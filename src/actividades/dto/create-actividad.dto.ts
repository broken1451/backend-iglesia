import { IsISO8601, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from "class-validator";
import { NormalizeSpaces } from "../../common/transforms/normalize-spaces.transform.js";

/**
 * Body de POST /api/actividades. Los campos corresponden a la tarjeta del calendario del sitio.
 */
export class CreateActividadDto {

    /** Título de la tarjeta. Obligatorio. */
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    titulo: string;

    /** Descripción breve de la tarjeta. */
    @IsString()
    @IsOptional()
    @MaxLength(500)
    descripcion?: string;

    // Fecha ISO con la zona horaria de Chile, ej: "2026-10-31T19:00:00-03:00"
    /** Inicio. Obligatorio. Sin zona horaria se interpretaría como UTC y la hora saldría corrida. */
    @IsISO8601()
    fecha_inicio: string;

    /** Término, solo en actividades de varios días. No puede ser anterior a fecha_inicio. */
    @IsISO8601()
    @IsOptional()
    fecha_fin?: string;

    // "Temuco", "En línea"
    /** Lugar. */
    @IsString()
    @IsOptional()
    @MaxLength(100)
    lugar?: string;

    // Sin distrito = "Nacional"
    /** Distrito de la etiqueta. Se normalizan los espacios para que coincida con el de las iglesias. */
    @NormalizeSpaces()
    @IsString()
    @IsOptional()
    @MaxLength(100)
    distrito?: string;

    /** Enlace de inscripción. Si viene, el sitio muestra el botón "Inscribirme". */
    @IsUrl()
    @IsOptional()
    inscripcion_url?: string;
}
