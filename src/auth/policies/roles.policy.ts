import { Policy } from '@nestjs/authorization';
import { Auth } from '../entities/auth.entity.js';
import { ValidRoles } from '../interfaces/role.enum.js';

@Policy()
export class RolesPolicy {

  // El usuario pasa si tiene alguno de los roles pedidos. ADMIN pasa siempre.
  hasRole(user: Auth | null, roles: readonly ValidRoles[]): boolean {
    if (!user) return false;
    if (user.roles.includes(ValidRoles.admin)) return true;
    return roles.some((role) => user.roles.includes(role));
  }
}
