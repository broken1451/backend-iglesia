import { containsRegex, definedOnly, equalsRegex } from './mongo.utils.js';

describe('containsRegex', () => {
  it.each([
    ['concepcion', 'Iglesia de Concepción'],
    ['CONCEPCIÓN', 'Iglesia de Concepción'],
    ['nunoa', 'Iglesia de Ñuñoa'],
    ['  iglesia   central ', 'Iglesia Central'],
    ['(central)', 'Iglesia (Central)'],
  ])('"%s" encuentra "%s"', (search, text) => {
    expect(containsRegex(search).test(text)).toBe(true);
  });

  it('no trata los caracteres especiales como regex', () => {
    expect(containsRegex('.*').test('Iglesia Central')).toBe(false);
  });
});

describe('equalsRegex', () => {
  it('compara el texto completo sin tildes ni mayúsculas', () => {
    expect(equalsRegex('araucania').test('Araucanía')).toBe(true);
    expect(equalsRegex('araucania').test('Araucanía Norte')).toBe(false);
  });
});

describe('definedOnly', () => {
  it('quita undefined pero conserva null, false y 0', () => {
    expect(definedOnly({ a: undefined, b: null, c: false, d: 0 })).toEqual({ b: null, c: false, d: 0 });
  });
});
