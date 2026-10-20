import { IsEmail, IsLatitude, IsLongitude, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { NormalizeSpaces } from "../../common/transforms/normalize-spaces.transform.js";

/**
 * Body de POST /api/iglesias.
 *
 * Los decoradores se ejecutan antes del controller (ValidationPipe de main.ts);
 * si algo no cumple, se responde 400 con la lista de errores. @NormalizeSpaces()
 * limpia los espacios antes de validar.
 */
export class CreateIglesiaDto {

    /** Distrito al que pertenece. Obligatorio. */
    @NormalizeSpaces()
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    distrito: string;

    /** Nombre. Obligatorio y único dentro del distrito. */
    @NormalizeSpaces()
    @IsString()
    @IsNotEmpty()
    @MaxLength(150)
    name: string;

    /** Dirección postal. */
    @NormalizeSpaces()
    @IsString()
    @IsOptional()
    @MaxLength(250)
    direccion?: string;

    /** Horarios de reunión, texto libre. No se normalizan los espacios para respetar el formato. */
    @IsString()
    @IsOptional()
    @MaxLength(250)
    reuniones?: string;

    /** Pastor o persona encargada. */
    @NormalizeSpaces()
    @IsString()
    @IsOptional()
    @MaxLength(150)
    encargado?: string;

    /** Correo de contacto. */
    @IsEmail()
    @IsOptional()
    email?: string;

    // Números en el JSON, ej: "lat": -33.4489. Van siempre juntos: lat y lng, o ninguno
    // (eso no se puede expresar con decoradores; lo valida IglesiasService)
    /** Latitud para el mapa. */
    @IsLatitude()
    @IsOptional()
    lat?: number;

    /** Longitud para el mapa. */
    @IsLongitude()
    @IsOptional()
    lng?: number;
}
