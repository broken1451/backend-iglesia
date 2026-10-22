import { IsEmail, IsMongoId, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

/**
 * Solo letras y espacios. \p{L} acepta cualquier letra de cualquier idioma
 * (á, é, ñ, ü...), así "José Muñoz" es válido; [a-zA-Z] los rechazaría.
 */
const ONLY_LETTERS = /^[\p{L}\s]+$/u;

/**
 * Body de POST /api/auth/register (público).
 *
 * Los roles NO se aceptan aquí: si el registro público aceptara roles, cualquiera
 * podría crearse una cuenta ADMIN. Todo usuario nuevo queda con rol IGLESIA y un
 * ADMIN se los cambia con PATCH /api/auth/:id. Como main.ts rechaza campos no
 * declarados, mandar "roles" responde 400.
 */
export class CreateAuthDto {

    /** Nombre. Se guarda en minúsculas. */
    @IsString()
    @IsNotEmpty()
    @Matches(ONLY_LETTERS, {
        message: 'The name must contain only letters and spaces.',
    })
    name: string;

    /** Apellido. Se guarda en minúsculas. */
    @IsString()
    @IsNotEmpty()
    @Matches(ONLY_LETTERS, {
        message: 'The last_name must contain only letters and spaces.',
    })
    last_name: string;

    /** Correo, único por usuario. Se guarda en minúsculas. */
    @IsEmail()
    email: string;

    /** Contraseña en texto plano; se guarda solo su hash (ver AuthService.register). */
    @IsString()
    @MinLength(6)
    @MaxLength(50)
    password: string;

    /**
     * Id de la iglesia del usuario (se elige de GET /api/iglesias). Opcional: si no viene,
     * el usuario se crea sin iglesia y un ADMIN se la asigna después con PATCH /api/auth/:id.
     * Mientras tanto no puede hacer login (ver AuthService.login).
     * Si viene, debe existir y estar activa (lo revisa AuthService).
     */
    @IsOptional()
    @IsMongoId({ message: 'iglesia must be the _id of an iglesia (from GET /api/iglesias)' })
    iglesia?: string;
}
