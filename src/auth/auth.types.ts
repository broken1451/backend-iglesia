import type { Auth } from './entities/auth.entity.js';

// Le dice a @nestjs/authentication qué tipo tiene el usuario autenticado
// (@CurrentUser()) y que no usamos refresh tokens (issue() devuelve solo accessToken).
declare module '@nestjs/authentication' {
  interface AuthenticationTypes {
    user: Auth;
    refreshTokens: false;
  }
}
