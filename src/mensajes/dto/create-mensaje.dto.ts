import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from "class-validator";
import { NormalizeSpaces } from "../../common/transforms/normalize-spaces.transform.js";

/**
 * Body de POST /api/mensajes: el formulario de contacto del sitio (público).
 * Los límites de largo evitan que alguien use el formulario para guardar textos enormes.
 */
export class CreateMensajeDto {

    /** Nombre. Obligatorio. */
    @NormalizeSpaces()
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    nombre: string;

    /** Correo para responder. Obligatorio. */
    @IsEmail()
    @MaxLength(150)
    email: string;

    /** Teléfono, opcional. Mismo formato que el de las iglesias. */
    @NormalizeSpaces()
    @IsString()
    @IsOptional()
    @Matches(/^\+?[\d\s()-]{7,20}$/, { message: 'telefono must be a phone number, e.g. +56 9 1234 5678' })
    telefono?: string;

    /** Asunto, opcional. */
    @NormalizeSpaces()
    @IsString()
    @IsOptional()
    @MaxLength(150)
    asunto?: string;

    /** El mensaje. Obligatorio. */
    @IsString()
    @IsNotEmpty()
    @MaxLength(2000)
    mensaje: string;
}
