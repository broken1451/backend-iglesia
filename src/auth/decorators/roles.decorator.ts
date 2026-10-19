import { Can } from '@nestjs/authorization';
import { ValidRoles } from '../interfaces/role.enum.js';
import { RolesPolicy } from '../policies/roles.policy.js';

/**
 * Restringe la ruta (o el controller completo) a los roles indicados.
 * Sin roles = cualquier usuario autenticado.
 *
 * @example
 * @Roles(ValidRoles.admin, ValidRoles.distrito)
 * @Get()
 * findAll() {}
 */
export const Roles = (...roles: ValidRoles[]) =>
  roles.length === 0
    ? Can.Anyone()
    : Can(RolesPolicy, 'hasRole', () => [roles] as const);
