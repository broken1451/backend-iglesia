/** Un distrito de la Convención. La misma forma que usa el front. */
export interface Distrito {
  /** Identificador sin tildes ni espacios: el value del selector del formulario ("araucania"). */
  id: string;
  /** Cómo se muestra, y lo que se guarda en cada iglesia ("Araucanía"). */
  nombre: string;
  /** Las ciudades o provincias que abarca, para mostrar bajo el nombre. */
  zona: string;
}

/**
 * Los distritos de la Convención, en el orden en que los muestra el panel (de norte a sur).
 * Es la misma lista que tiene el front: si se cambia aquí, hay que cambiarla allá (o que el
 * front la pida a GET /api/iglesias/distritos en vez de tenerla escrita).
 *
 * - Es la lista del selector "Distrito" del formulario de iglesias: crear o editar una iglesia
 *   con un distrito que no esté aquí responde 400. Así no aparecen distritos repetidos por un
 *   error de tipeo ("Araucania" / "Araucanía").
 * - Define el orden de GET /api/iglesias/distritos y de "Avance de fichas por distrito".
 *
 * Para agregar uno, se suma aquí en su lugar.
 */
export const DISTRITOS = [
  { id: 'norte', nombre: 'Norte', zona: 'Antofagasta y La Serena' },
  { id: 'metropolitano', nombre: 'Metropolitano', zona: 'Santiago, San Antonio y Rancagua' },
  { id: 'valle-central', nombre: 'Valle Central', zona: 'Curicó, Talca, Linares y Ñuble' },
  { id: 'biobio', nombre: 'Biobío', zona: 'Concepción, Arauco y Los Ángeles' },
  { id: 'araucania', nombre: 'Araucanía', zona: 'Temuco, Malleco y Cautín' },
  { id: 'los-rios', nombre: 'Los Ríos', zona: 'Panguipulli, Lanco y Paillaco' },
] as const satisfies readonly Distrito[];

/** Los nombres válidos, para @IsIn() del DTO. */
export const NOMBRES_DISTRITO: readonly string[] = DISTRITOS.map((distrito) => distrito.nombre);

/** El distrito de la lista con ese id o ese nombre (sin distinguir mayúsculas), o undefined. */
export const buscarDistrito = (valor: string): Distrito | undefined => {
  const buscado = valor.toLowerCase();
  return DISTRITOS.find((distrito) => distrito.id === buscado || distrito.nombre.toLowerCase() === buscado);
};

/**
 * Lo que llega en el body o en ?distrito= (el id del selector o el nombre) → el nombre que
 * se guarda. Si no es de la lista lo deja igual, para que la validación responda 400.
 *
 * @example nombreDistrito('araucania') // 'Araucanía'
 * @example nombreDistrito('Araucanía') // 'Araucanía'
 * @example nombreDistrito('Atacama')   // 'Atacama' (y @IsIn lo rechaza)
 */
export const nombreDistrito = (valor: string) => buscarDistrito(valor)?.nombre ?? valor;

/**
 * Pone los resultados de una agregación (una fila por distrito, con el nombre en `distrito`)
 * en el orden de DISTRITOS y con la forma del front: { id, nombre, zona, ...los datos }.
 *
 * - Un distrito de la lista sin filas aparece igual, con los datos de `vacia` (en 0).
 * - Un distrito en la base que no está en la lista (iglesias cargadas antes de que existiera)
 *   va al final, en orden alfabético, con id y zona en null.
 *
 * @example conDatosDeDistrito([{ distrito: 'Araucanía', total: 3 }], { total: 0 })
 *          // [{ id: 'norte', nombre: 'Norte', zona: '...', total: 0 }, ..., { id: 'araucania', ..., total: 3 }, ...]
 */
export const conDatosDeDistrito = <D extends object>(filas: (D & { distrito: string })[], vacia: D) => {
  const porNombre = new Map(filas.map(({ distrito, ...datos }) => [distrito, datos as unknown as D]));
  const deLaLista = DISTRITOS.map(({ id, nombre, zona }) => ({ id, nombre, zona, ...(porNombre.get(nombre) ?? vacia) }));
  const otros = filas
    .filter((fila) => !NOMBRES_DISTRITO.includes(fila.distrito))
    .sort((a, b) => a.distrito.localeCompare(b.distrito, 'es'))
    .map(({ distrito, ...datos }) => ({ id: null, nombre: distrito, zona: null, ...(datos as unknown as D) }));
  return [...deLaLista, ...otros];
};
