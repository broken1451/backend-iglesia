import { camposFaltantes, estadoFicha, faltaAlguno, nombrarCampos, tieneTodos } from './pendientes.utils.js';

describe('pendientes.utils', () => {
  it('camposFaltantes: cuenta como vacío lo que no existe, null o ""', () => {
    const iglesia = { reuniones: 'Domingo 11:00', direccion: '', email: null };
    expect(camposFaltantes(iglesia, ['reuniones', 'direccion', 'email'] as const)).toEqual(['direccion', 'email']);
    expect(camposFaltantes({ lugar: 'Temuco', descripcion: 'x' }, ['descripcion', 'lugar'] as const)).toEqual([]);
  });

  it('faltaAlguno: arma el filtro de Mongo con un $or por campo', () => {
    expect(faltaAlguno(['lugar', 'descripcion'])).toEqual({
      $or: [{ lugar: { $in: [null, ''] } }, { descripcion: { $in: [null, ''] } }],
    });
  });

  it('nombrarCampos: frase con mayúscula inicial y "y" antes del último', () => {
    expect(nombrarCampos(['reuniones', 'direccion', 'email'])).toBe('Horario, dirección y correo');
    expect(nombrarCampos(['descripcion', 'lugar'])).toBe('Descripción y lugar');
    expect(nombrarCampos(['imagen'])).toBe('Imagen');
  });

  it('tieneTodos: el filtro contrario, con un $nin por campo', () => {
    expect(tieneTodos(['lugar', 'descripcion'])).toEqual({
      $and: [{ lugar: { $nin: [null, ''] } }, { descripcion: { $nin: [null, ''] } }],
    });
  });

  it('estadoFicha: las columnas "Ficha" (0/5) y "Estado" de la tabla', () => {
    expect(estadoFicha(5, 5)).toEqual({ completos: 0, total: 5, porcentaje: 0, completa: false, estado: 'Faltan 5' });
    expect(estadoFicha(1, 5)).toEqual({ completos: 4, total: 5, porcentaje: 80, completa: false, estado: 'Falta 1' });
    expect(estadoFicha(0, 5)).toEqual({ completos: 5, total: 5, porcentaje: 100, completa: true, estado: 'Completa' });
  });
});
