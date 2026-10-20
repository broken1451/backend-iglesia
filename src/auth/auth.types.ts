import type { Auth } from './entities/auth.entity.js';

/**
 * Configura los tipos de @nestjs/authentication para este proyecto:
 * - user: el usuario autenticado es un documento Auth. Así @CurrentUser() y
 *   request.user quedan tipados y el editor autocompleta user.roles, user.email, etc.
 * - refreshTokens: false: no se usan refresh tokens, así que TokenService.issue()
 *   devuelve solo { accessToken, expiresIn }. Debe coincidir con `refreshToken: false`
 *   en auth.module.ts.
 *
 * Este archivo no exporta nada: solo hay que importarlo una vez (lo hace auth.module.ts).
 */
declare module '@nestjs/authentication' {
  interface AuthenticationTypes {
    user: Auth;
    refreshTokens: false;
  }
}
