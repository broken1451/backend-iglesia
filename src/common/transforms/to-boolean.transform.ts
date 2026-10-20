import { Transform } from 'class-transformer';

/**
 * Decorador para filtros booleanos de la URL (?isActive=false, ?publicado=true).
 *
 * Por qué: todo lo que viene en la URL llega como texto, y "false" como texto es
 * un valor "verdadero" en JavaScript. Esto convierte "true" → true y "false" → false.
 * Cualquier otro valor ("quizas") se deja tal cual para que @IsBoolean() responda 400.
 */
export const ToBoolean = () =>
  Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value));
