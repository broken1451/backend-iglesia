import { BadRequestException } from '@nestjs/common';

/**
 * Escapa los caracteres que tienen significado especial en una expresión regular.
 *
 * Por qué: las búsquedas se hacen con regex. Sin escapar, buscar "(central" rompería
 * la consulta y buscar ".*" devolvería todo.
 *
 * @example escapeRegex('(central)') // '\\(central\\)'
 */
export const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Para cada vocal (y la n), el grupo de letras que se acepta en su lugar.
 * Así "concepcion" encuentra "Concepción" y "nunoa" encuentra "Ñuñoa".
 */
const ACCENTS: Record<string, string> = {
  a: '[aáàäâ]', e: '[eéèëê]', i: '[iíìïî]', o: '[oóòöô]', u: '[uúùüû]', n: '[nñ]',
};

/**
 * Convierte el texto que escribió el usuario en un patrón que ignora tildes,
 * mayúsculas y espacios repetidos, venga escrito como venga:
 * 1. Quita espacios de los extremos y deja uno solo donde había varios.
 * 2. Quita las tildes que traiga ("Concepción" → "concepcion").
 * 3. Pasa a minúsculas.
 * 4. Escapa los caracteres especiales.
 * 5. Reemplaza cada vocal y la n por su grupo de ACCENTS.
 *
 * @example accentInsensitive('Concepción') // 'c[oóòöô][nñ]c[eéèëê]pc[iíìïî][oóòöô][nñ]'
 */
const accentInsensitive = (text: string) =>
  escapeRegex(
    text.trim().replace(/\s+/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(),
  ).replace(/[aeioun]/g, (letter) => ACCENTS[letter]);

/**
 * Regex de "contiene", sin distinguir mayúsculas ni tildes. Se usa para ?search=.
 *
 * @example containsRegex('concepcion').test('Iglesia de Concepción') // true
 */
export const containsRegex = (text: string) => new RegExp(accentInsensitive(text), 'i');

/**
 * Regex de "es exactamente", sin distinguir mayúsculas ni tildes. Se usa para ?distrito=.
 *
 * @example equalsRegex('araucania').test('Araucanía')       // true
 * @example equalsRegex('araucania').test('Araucanía Norte') // false
 */
export const equalsRegex = (text: string) => new RegExp(`^${accentInsensitive(text)}$`, 'i');

/**
 * Devuelve una copia del DTO sin los campos que valen undefined.
 *
 * Por qué: al validar, los campos del DTO que no venían en el body llegan como
 * undefined. Si se guardaran así, un PATCH que solo cambia el nombre borraría
 * el resto (este bug existió: borraba isActive). null sí se conserva, porque
 * sirve para borrar un valor a propósito (ej. { "lat": null, "lng": null }).
 *
 * @example definedOnly({ a: 1, b: undefined, c: null }) // { a: 1, c: null }
 */
export const definedOnly = <T extends object>(dto: T): Partial<T> =>
  Object.fromEntries(Object.entries(dto).filter(([, value]) => value !== undefined)) as Partial<T>;

/**
 * Se usa en el catch de un create/save. Si el error es de índice único de Mongo
 * (código 11000), lo convierte en un 400 con el mensaje indicado. Cualquier otro
 * error se vuelve a lanzar tal cual.
 *
 * Por qué: sin esto, un duplicado llegaría al cliente como un 500 sin explicación.
 *
 * @param error   lo que se atrapó en el catch
 * @param message el texto para el cliente (ej. "Ya existe una iglesia con ese nombre")
 * @throws siempre: BadRequestException si es duplicado, o el error original
 */
export const rethrowDuplicate = (error: unknown, message: string): never => {
  if ((error as { code?: number })?.code === 11000) throw new BadRequestException(message);
  throw error;
};

/**
 * Arma la respuesta estándar de todos los listados, para que el front siempre
 * reciba la misma forma: { total, limit, offset, data }.
 * `total` es la cantidad que cumple los filtros (no solo la página), para calcular páginas.
 */
export const paginated = <T>(data: T[], total: number, limit: number, offset: number) =>
  ({ total, limit, offset, data });
