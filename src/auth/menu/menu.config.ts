import { ValidRoles } from '../interfaces/role.enum.js';

const { admin, comunicaciones, distrito, iglesia } = ValidRoles;

/** Una sección del menú del panel. */
export interface MenuItem {
  /** Texto que muestra el panel */
  titulo: string;
  /** Nombre del ícono que usa el front */
  icono: string;
  /** Ruta de la sección */
  ruta: string;
  /** Roles que ven esta sección (y que pueden usar su API) */
  roles: readonly ValidRoles[];
  /**
   * Roles que además pueden crear y editar (ADMIN siempre puede). Lo usan los @Roles de
   * POST/PATCH en el controller y el "Por hacer" (GET /api/resumen/por-hacer), para no
   * proponerle a alguien una tarea que la API le respondería con 403.
   * Sin definir = la sección todavía no tiene API.
   */
  editan?: readonly ValidRoles[];
}

/**
 * Única fuente de verdad: qué roles ven cada sección del menú.
 *
 * Se usa en dos lugares:
 * 1. getMenu(): el login devuelve el menú del usuario.
 * 2. Los controllers: @Roles(...MENU.iglesias.roles) protege la API con los mismos roles,
 *    y @Roles(...MENU.iglesias.editan) protege crear y editar.
 * 3. El "Por hacer" del panel (puedeEditar): solo propone tareas que el usuario puede hacer.
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
  resumen:       { titulo: 'Resumen',          icono: 'grafico',   ruta: "resumen", roles: [admin, comunicaciones, distrito, iglesia] },
  iglesias:      { titulo: 'Iglesias',         icono: 'templo',    ruta: "iglesias", roles: [admin, distrito, iglesia], editan: [distrito] },
  noticias:      { titulo: 'Noticias',         icono: 'diario',    ruta: "noticias", roles: [admin, comunicaciones], editan: [comunicaciones] },
  actividades:   { titulo: 'Actividades',      icono: 'calendario',ruta: "actividades", roles: [admin, comunicaciones, distrito, iglesia], editan: [comunicaciones, distrito] },
  devocional:    { titulo: 'Devocional',       icono: 'libro',     ruta: "devocional", roles: [admin, comunicaciones] },
  proyectos:     { titulo: 'Proyectos',        icono: 'semilla',   ruta: "proyectos", roles: [admin, comunicaciones] },
  directiva:     { titulo: 'Directiva',        icono: 'usuarios',  ruta: "directiva", roles: [admin] },
  mensajes:      { titulo: 'Mensajes',         icono: 'bandeja',   ruta: "mensajes", roles: [admin, comunicaciones, distrito, iglesia], editan: [comunicaciones, distrito, iglesia] },
  usuarios:      { titulo: 'Usuarios y roles', icono: 'llave',     ruta: "usuarios", roles: [admin] },
  configuracion: { titulo: 'Configuración',    icono: 'ajustes',   ruta: "configuracion", roles: [admin, comunicaciones] },
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
    .map(({ titulo, icono, ruta }) => ({ titulo, icono, ruta }));

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

/** Las secciones de MENU que tienen `editan` (las que ya tienen API de edición). */
export type SeccionEditable = {
  [K in keyof typeof MENU]: (typeof MENU)[K] extends { editan: readonly ValidRoles[] } ? K : never;
}[keyof typeof MENU];

/**
 * ¿El usuario puede crear y editar en esta sección? ADMIN siempre; el resto, si alguno de
 * sus roles está en `editan`. Es la misma regla que aplica @Roles(...MENU.x.editan).
 *
 * @param user    usuario del token, o null/undefined si es un visitante
 * @param section sección con API de edición
 */
export const puedeEditar = (
  user: { roles: readonly ValidRoles[] } | null | undefined,
  section: SeccionEditable,
) =>
  !!user &&
  (user.roles.includes(admin) || MENU[section].editan.some((role) => user.roles.includes(role)));

/**
 * Botones de "Accesos rápidos" del Resumen. Cada uno lleva a una sección del menú; con
 * `nuevo`, directo al formulario de crear (ruta "noticias/nueva").
 *
 * Quién los ve: si la sección tiene API de edición (`editan`), quien puede editar; si
 * todavía no la tiene (proyectos, devocional), quien ve la sección en el menú.
 */
export const ACCESOS_RAPIDOS = [
  { titulo: 'Publicar noticia',     seccion: 'noticias',    nuevo: true },
  { titulo: 'Crear actividad',      seccion: 'actividades', nuevo: true },
  { titulo: 'Actualizar proyectos', seccion: 'proyectos',   nuevo: false },
  { titulo: 'Programar devocional', seccion: 'devocional',  nuevo: false },
] as const satisfies readonly { titulo: string; seccion: keyof typeof MENU; nuevo: boolean }[];

/**
 * Los accesos rápidos de un usuario, con el ícono y la ruta de su sección.
 * @returns [{ titulo: "Publicar noticia", icono: "diario", ruta: "noticias/nueva" }, ...]
 */
export const getAccesosRapidos = (user: { roles: readonly ValidRoles[] }) =>
  ACCESOS_RAPIDOS.filter(({ seccion }) => {
    const item: MenuItem = MENU[seccion];
    return item.editan ? puedeEditar(user, seccion as SeccionEditable) : hasMenuAccess(user, seccion);
  }).map(({ titulo, seccion, nuevo }) => ({
    titulo,
    icono: MENU[seccion].icono,
    ruta: nuevo ? `${MENU[seccion].ruta}/nueva` : MENU[seccion].ruta,
  }));

