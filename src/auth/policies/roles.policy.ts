import { Policy } from '@nestjs/authorization';
import { Auth } from '../entities/auth.entity.js';
import { ValidRoles } from '../interfaces/role.enum.js';

/**
 * Regla de autorización por roles. No se usa directamente: la aplica el
 * decorador @Roles(...) (decorators/roles.decorator.ts) a través del guard global.
 *
 * @Policy() la registra en @nestjs/authorization; debe estar en los providers
 * de algún módulo (está en AuthModule).
 */
@Policy()
export class RolesPolicy {

  /**
   * ¿El usuario tiene alguno de los roles pedidos?
   *
   * El guard la llama así: hasRole(usuarioDelToken, rolesDelDecorador).
   *
   * @param user  usuario autenticado; null si no hay sesión (la librería exige aceptar null)
   * @param roles roles que pide la ruta; basta con tener UNO de ellos
   * @returns true si puede pasar. ADMIN siempre pasa; sin usuario, nunca.
   */
  hasRole(user: Auth | null, roles: readonly ValidRoles[]): boolean {
    if (!user) return false;
    if (user.roles.includes(ValidRoles.admin)) return true;
    return roles.some((role) => user.roles.includes(role));
  }
}
