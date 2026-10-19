import { IsEmail, IsString, MaxLength } from "class-validator";

export class LoginAuthDto {

    @IsEmail()
    email: string;

    @IsString()
    @MaxLength(50)
    password: string;
}
