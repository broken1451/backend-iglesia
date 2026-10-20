/**
 * Categorías de noticia: la etiqueta de la tarjeta.
 *
 * El valor es el texto que se muestra tal cual. Es una lista fija (y no texto libre)
 * porque el front elige el ícono del placeholder según la categoría: un valor
 * inesperado dejaría la tarjeta sin ícono.
 *
 * Para agregar una categoría nueva basta con sumarla aquí (y su ícono en el front).
 */
export enum NoticiaCategoria {
    /** Ícono: ubicación */
    misiones = 'Misiones',
    /** Ícono: diario */
    comunicado = 'Comunicado oficial',
    /** Ícono: corazón */
    oracion = 'Oración',
    /** Ícono: diario */
    historia = 'Historia',
}
