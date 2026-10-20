import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Error as MongooseError } from 'mongoose';

/**
 * Convierte los errores de validación de Mongoose en un 400, con la misma forma que los
 * del ValidationPipe: { message: [...], error: "Bad Request", statusCode: 400 }.
 *
 * Por qué: el DTO valida casi todo, pero hay casos que solo detecta el esquema al guardar.
 * Por ejemplo, un PATCH con { "titulo": null }: @IsOptional() deja pasar null y el esquema
 * lo rechaza por ser obligatorio. Sin este filtro, eso llegaría al cliente como un 500.
 *
 * - ValidationError: un campo no cumple el esquema (obligatorio, enum, min/max).
 * - CastError: un valor no se puede convertir al tipo del campo (ej. un id mal formado).
 *
 * Se registra para toda la app en main.ts (app.useGlobalFilters).
 */
@Catch(MongooseError.ValidationError, MongooseError.CastError)
export class MongooseExceptionFilter extends BaseExceptionFilter implements ExceptionFilter {
  catch(error: MongooseError.ValidationError | MongooseError.CastError, host: ArgumentsHost) {
    const messages =
      error instanceof MongooseError.ValidationError
        ? Object.values(error.errors).map((detail) => detail.message)
        : [`${error.path} has an invalid value`];
    // BaseExceptionFilter arma la respuesta HTTP igual que Nest lo hace con cualquier 400
    super.catch(new BadRequestException(messages), host);
  }
}
