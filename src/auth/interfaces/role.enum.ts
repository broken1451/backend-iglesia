/**
 * Los roles que puede tener un usuario. Un usuario puede tener varios.
 * El valor (texto en mayúsculas) es lo que se guarda en Mongo y viaja en las respuestas.
 */
export enum ValidRoles {
    /** Administración total. Pasa cualquier @Roles(...) */
    admin = 'ADMIN',
    /** Equipo que publica noticias y actividades */
    comunicaciones  = 'COMUNICACIONES',
    /** Encargados de distrito: gestionan iglesias y actividades */
    distrito = 'DISTRITO',
    /** Usuario de una iglesia. Rol por defecto al registrarse; hoy solo consulta */
    iglesia = 'IGLESIA'
}