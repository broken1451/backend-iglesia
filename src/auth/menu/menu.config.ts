import { ValidRoles } from '../interfaces/role.enum.js';

const { admin, comunicaciones, distrito, iglesia } = ValidRoles;

/** Una sección del menú del panel. */
export interface MenuItem {
  /** Texto que muestra el panel */
  titulo: string;
  /** Nombre del ícono que usa el front */
  icono: string;
  /** Roles que ven esta sección (y que pueden usar su API) */
  roles: readonly ValidRoles[];
}

/**
 * Única fuente de verdad: qué roles ven cada sección del menú.
 *
 * Se usa en dos lugares:
 * 1. getMenu(): el login devuelve el menú del usuario.
 * 2. Los controllers: @Roles(...MENU.iglesias.roles) protege la API con los mismos roles.
 *
 * Por qué: si el menú y los permisos estuvieran escritos por separado, tarde o temprano
 * dirían cosas distintas (un rol vería una sección cuya API le responde 403). Así, quitarle
 * una sección a un rol aquí también le cierra la API.
 *
 * El orden de las claves es el orden en que aparece en el menú.
 * `as const` permite usar MENU.iglesias.roles con tipos exactos; `satisfies` verifica que
 * cada sección tenga la forma de MenuItem.
 */
export const MENU = {
  resumen:       { titulo: 'Resumen',          icono: 'grafico',    roles: [admin, comunicaciones, distrito, iglesia] },
  iglesias:      { titulo: 'Iglesias',         icono: 'templo',     roles: [admin, distrito, iglesia] },
  noticias:      { titulo: 'Noticias',         icono: 'diario',     roles: [admin, comunicaciones] },
  actividades:   { titulo: 'Actividades',      icono: 'calendario', roles: [admin, comunicaciones, distrito, iglesia] },
  devocional:    { titulo: 'Devocional',       icono: 'libro',      roles: [admin, comunicaciones] },
  proyectos:     { titulo: 'Proyectos',        icono: 'semilla',    roles: [admin, comunicaciones] },
  directiva:     { titulo: 'Directiva',        icono: 'usuarios',   roles: [admin] },
  mensajes:      { titulo: 'Mensajes',         icono: 'bandeja',    roles: [admin, comunicaciones, distrito, iglesia] },
  usuarios:      { titulo: 'Usuarios y roles', icono: 'llave',      roles: [admin] },
  configuracion: { titulo: 'Configuración',    icono: 'ajustes',    roles: [admin, comunicaciones] },
} as const satisfies Record<string, MenuItem>;

/**
 * Arma el menú de un usuario según sus roles. Lo devuelve el login.
 *
 * Si tiene varios roles ve la UNIÓN de sus secciones (ej. COMUNICACIONES + DISTRITO
 * ve Noticias e Iglesias), en el orden de MENU y sin repetir.
 *
 * @returns solo { titulo, icono } de cada sección; los roles no se envían al front
 */
export const getMenu = (userRoles: readonly ValidRoles[]) =>
  Object.values(MENU)
    .filter((item) => item.roles.some((role) => userRoles.includes(role)))
    .map(({ titulo, icono }) => ({ titulo, icono }));

/**
 * ¿El usuario ve esta sección del menú?
 *
 * La usan los GET con @OptionalAuth() para decidir cuánto mostrar: quien gestiona la
 * sección (panel) ve también lo desactivado o los borradores; el resto, solo lo público.
 *
 * @param user    usuario del token, o null/undefined si es un visitante
 * @param section clave de MENU (ej. 'iglesias')
 * @returns false para visitantes; true si alguno de sus roles está en la sección
 */
export const hasMenuAccess = (
  user: { roles: readonly ValidRoles[] } | null | undefined,
  section: keyof typeof MENU,
) => !!user && MENU[section].roles.some((role) => user.roles.includes(role));
