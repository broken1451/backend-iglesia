import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from "class-validator";

// \p{L} acepta cualquier letra (á, é, ñ, ü...), así "José Muñoz" es válido
const ONLY_LETTERS = /^[\p{L}\s]+$/u;

export class CreateAuthDto {

    @IsString()
    @IsNotEmpty()
    @Matches(ONLY_LETTERS, {
        message: 'The name must contain only letters and spaces.',
    })
    name: string;

    @IsString()
    @IsNotEmpty()
    @Matches(ONLY_LETTERS, {
        message: 'The last_name must contain only letters and spaces.',
    })
    last_name: string;

    @IsEmail()
    email: string;

    @IsString()
    @MinLength(6)
    @MaxLength(50)
    password: string;

    // Los roles NO se aceptan en el registro público (sería escalada de privilegios).
    // Un ADMIN los asigna con PATCH /auth/:id.
}
