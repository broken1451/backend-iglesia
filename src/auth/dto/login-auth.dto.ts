import { IsEmail, IsString, MaxLength } from "class-validator";

/**
 * Body de POST /api/auth/login.
 */
export class LoginAuthDto {

    /** Correo con el que se registró. Se compara en minúsculas. */
    @IsEmail()
    email: string;

    /**
     * Contraseña en texto plano (viaja por HTTPS en producción).
     * Máximo 50, igual que en el registro: además evita que alguien mande un texto
     * enorme para hacer trabajar de más al hash.
     */
    @IsString()
    @MaxLength(50)
    password: string;
}
