import { applyDecorators } from '@nestjs/common';
import { Authenticate } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';

/**
 * Ruta abierta a visitantes que además reconoce al usuario si manda token.
 * - Sin token: entra igual y @CurrentUser() es null.
 * - Con token válido: @CurrentUser() es el usuario (para mostrarle más cosas).
 * - Con token vencido o inválido: 401 (no se trata como visitante).
 *
 * A diferencia de @Public(), que ni siquiera lee el token. Úsalo cuando la
 * respuesta cambia según quién consulta; la decisión la toma el handler/servicio
 * (ej. el sitio ve solo noticias publicadas y el panel también los borradores).
 *
 * Combina dos decoradores:
 * - Authenticate({ optional: true }): la autenticación deja pasar sin token.
 * - Can.Anyone(): la autorización deja pasar a cualquiera; anula el @Roles(...) de la clase.
 */
export const OptionalAuth = () =>
  applyDecorators(Authenticate({ optional: true }), Can.Anyone());
