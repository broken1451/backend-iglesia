/**
 * Pone en mayúscula la primera letra de cada palabra. Los nombres se guardan en minúsculas;
 * esto los deja presentables para mostrarlos (por ejemplo, en un correo).
 *
 * \p{L} reconoce cualquier letra, incluidas las con tilde y la ñ.
 *
 * @example capitalizar('josé maría') // 'José María'
 */
export const capitalizar = (texto: string) => texto.replace(/(^|\s)\p{L}/gu, (letra) => letra.toUpperCase());
