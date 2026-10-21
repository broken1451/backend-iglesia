import { camposFaltantes, faltaAlguno, nombrarCampos } from './pendientes.utils.js';

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
});
