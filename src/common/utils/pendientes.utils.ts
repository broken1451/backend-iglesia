/**
 * Utilidades del "Por hacer": qué datos le faltan a un registro para estar completo.
 *
 * Cada entidad declara sus campos de "ficha completa" (ej. CAMPOS_FICHA_IGLESIA). Con eso:
 * - El esquema expone el campo virtual `pendientes` (camposFaltantes): ["reuniones", "email"].
 * - Los listados aceptan ?pendientes=true (faltaAlguno): solo los incompletos.
 * - GET /api/resumen/por-hacer cuenta los incompletos y arma el texto (nombrarCampos).
 */

/** Cómo se nombra cada campo en los textos que ve el usuario del panel. */
const ETIQUETAS: Record<string, string> = {
  reuniones: 'horario',
  direccion: 'dirección',
  email: 'correo',
  encargado: 'pastor',
  telefono: 'teléfono',
  descripcion: 'descripción',
  lugar: 'lugar',
  imagen: 'imagen',
};

/** ¿El campo está vacío? Cuenta como vacío si no existe, es null o es texto vacío. */
const vacio = (valor: unknown) => valor == null || valor === '';

/**
 * Los campos de la lista que le faltan al registro, en el mismo orden de la lista.
 *
 * @example camposFaltantes({ direccion: 'Calle 1', email: '' }, ['reuniones', 'direccion', 'email'])
 *          // ['reuniones', 'email']
 */
export const camposFaltantes = <R extends object, T extends keyof R & string>(registro: R, campos: readonly T[]): T[] =>
  campos.filter((campo) => vacio(registro[campo]));

/**
 * Filtro de Mongo: registros a los que les falta al menos uno de los campos.
 * `$in: [null, '']` cubre los tres casos de vacío: el campo no existe, es null o es "".
 *
 * @example faltaAlguno(['lugar', 'descripcion'])
 *          // { $or: [{ lugar: { $in: [null, ''] } }, { descripcion: { $in: [null, ''] } }] }
 */
export const faltaAlguno = (campos: readonly string[]) => ({
  $or: campos.map((campo) => ({ [campo]: { $in: [null, ''] } })),
});

/**
 * Nombra los campos para una frase, con mayúscula inicial y "y" antes del último.
 *
 * @example nombrarCampos(['reuniones', 'direccion', 'email']) // 'Horario, dirección y correo'
 */
export const nombrarCampos = (campos: readonly string[]) => {
  const nombres = campos.map((campo) => ETIQUETAS[campo] ?? campo);
  const texto = nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}` : (nombres[0] ?? '');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

/**
 * Filtro de Mongo: registros que tienen TODOS los campos llenos (lo contrario de faltaAlguno).
 * `$nin: [null, '']` excluye los tres casos de vacío: no existe, es null o es "".
 *
 * @example tieneTodos(['lugar']) // { $and: [{ lugar: { $nin: [null, ''] } }] }
 */
export const tieneTodos = (campos: readonly string[]) => ({
  $and: campos.map((campo) => ({ [campo]: { $nin: [null, ''] } })),
});

/**
 * Columnas "Ficha" (0/5 con barra) y "Estado" ("Faltan 5" / "Completa") de la tabla del panel.
 *
 * @param faltan cuántos datos faltan
 * @param total  cuántos datos tiene una ficha completa
 * @example estadoFicha(5, 5) // { completos: 0, total: 5, porcentaje: 0, completa: false, estado: 'Faltan 5' }
 * @example estadoFicha(1, 5) // { completos: 4, total: 5, porcentaje: 80, completa: false, estado: 'Falta 1' }
 */
export const estadoFicha = (faltan: number, total: number) => {
  const completos = total - faltan;
  return {
    completos,
    total,
    porcentaje: total ? Math.round((completos / total) * 100) : 100,
    completa: faltan === 0,
    estado: faltan === 0 ? 'Completa' : `${faltan === 1 ? 'Falta' : 'Faltan'} ${faltan}`,
  };
};
