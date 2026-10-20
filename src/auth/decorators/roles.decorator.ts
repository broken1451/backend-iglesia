import { Can } from '@nestjs/authorization';
import { ValidRoles } from '../interfaces/role.enum.js';
import { RolesPolicy } from '../policies/roles.policy.js';

/**
 * Restringe la ruta (o el controller completo) a los roles indicados.
 * ADMIN siempre pasa. Sin token responde 401; con token pero sin el rol, 403.
 *
 * - `@Roles()` sin roles = cualquier usuario autenticado.
 * - En la clase y en el método a la vez se SUMAN: hay que cumplir los dos.
 * - `@Public()` u `@OptionalAuth()` en un método anulan el @Roles de la clase.
 *
 * Por dentro es `Can(RolesPolicy, 'hasRole', () => [roles])`:
 * - RolesPolicy: la clase con la regla.
 * - 'hasRole': el método a ejecutar.
 * - () => [roles]: los argumentos que van DESPUÉS del usuario. Es una lista de
 *   argumentos con un solo elemento (el arreglo de roles), por eso [roles] y no roles.
 *   El guard termina llamando hasRole(usuario, roles).
 * - as const: lo tipa como tupla de un elemento para que TypeScript verifique
 *   que coincide con los parámetros de hasRole.
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
