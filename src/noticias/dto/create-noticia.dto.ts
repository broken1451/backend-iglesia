import { IsBoolean, IsEnum, IsISO8601, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from "class-validator";
import { NoticiaCategoria } from "../interfaces/categoria.enum.js";

/**
 * Body de POST /api/noticias. Los campos corresponden a la tarjeta de noticias del sitio.
 */
export class CreateNoticiaDto {

    /** Título. Obligatorio. */
    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    titulo: string;

    /** Texto corto de la tarjeta. Obligatorio. */
    @IsString()
    @IsNotEmpty()
    @MaxLength(300)
    resumen: string;

    /** Una de NoticiaCategoria: "Misiones", "Comunicado oficial", "Oración", "Historia". */
    @IsEnum(NoticiaCategoria)
    categoria: NoticiaCategoria;

    /** Texto completo de la noticia. Obligatorio. */
    @IsString()
    @IsNotEmpty()
    @MaxLength(20000)
    contenido: string;

    /** URL de la imagen principal. */
    @IsUrl()
    @IsOptional()
    imagen?: string;

    // Por defecto se crea como borrador
    /** true la publica de inmediato. */
    @IsBoolean()
    @IsOptional()
    publicado?: boolean;

    // Opcional: por defecto es el momento en que se publica.
    // Sirve para cargar noticias antiguas con su fecha original.
    /** Fecha ISO. */
    @IsISO8601()
    @IsOptional()
    fecha_publicacion?: string;

    // El autor NO se recibe: se toma del usuario autenticado
}
