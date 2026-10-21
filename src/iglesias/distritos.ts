/**
 * Los distritos de la Convención, en el orden en que los muestra el panel (de norte a sur).
 *
 * Es la lista del selector "Distrito" del formulario de iglesias: crear o editar una iglesia
 * con un distrito que no esté aquí responde 400. Así no aparecen distritos repetidos por un
 * error de tipeo ("Araucania" / "Araucanía"). Para agregar uno, se suma aquí en su lugar.
 *
 * Lo entrega GET /api/iglesias/distritos, y también ordena "Avance de fichas por distrito".
 */
export const DISTRITOS = ['Norte', 'Metropolitano', 'Valle Central', 'Biobío', 'Araucanía', 'Los Ríos'] as const;

export type Distrito = (typeof DISTRITOS)[number];

/**
 * Pone primero los distritos de la lista, en su orden, y luego cualquier otro que haya en
 * la base (datos cargados antes de que existiera la lista), en orden alfabético.
 *
 * @param filas    resultado de una agregación, una fila por distrito
 * @param vacia    la fila a usar para un distrito de la lista que no tiene iglesias
 * @example ordenarPorDistrito([{ distrito: 'Araucanía', total: 3 }], (distrito) => ({ distrito, total: 0 }))
 *          // [{ Norte, 0 }, { Metropolitano, 0 }, ..., { Araucanía, 3 }, { Los Ríos, 0 }]
 */
export const ordenarPorDistrito = <T extends { distrito: string }>(filas: T[], vacia: (distrito: string) => T): T[] => {
  const porNombre = new Map(filas.map((fila) => [fila.distrito, fila]));
  const otros = filas
    .filter((fila) => !(DISTRITOS as readonly string[]).includes(fila.distrito))
    .sort((a, b) => a.distrito.localeCompare(b.distrito, 'es'));
  return [...DISTRITOS.map((distrito) => porNombre.get(distrito) ?? vacia(distrito)), ...otros];
};
