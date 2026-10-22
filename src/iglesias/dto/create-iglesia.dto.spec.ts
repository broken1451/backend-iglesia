import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateIglesiaDto } from './create-iglesia.dto.js';

/** Convierte y valida el body igual que el ValidationPipe de main.ts. */
const validar = async (body: object) => {
  const dto = plainToInstance(CreateIglesiaDto, body);
  return { dto, errores: (await validate(dto)).flatMap((error) => Object.values(error.constraints ?? {})) };
};

describe('CreateIglesiaDto · distrito', () => {
  it('acepta el id del selector y guarda el nombre', async () => {
    const { dto, errores } = await validar({ name: 'X', distrito: 'araucania' });
    expect(errores).toEqual([]);
    expect(dto.distrito).toBe('Araucanía');
  });

  it('acepta el nombre, con o sin mayúsculas', async () => {
    expect((await validar({ name: 'X', distrito: 'Los Ríos' })).dto.distrito).toBe('Los Ríos');
    expect((await validar({ name: 'X', distrito: 'VALLE CENTRAL' })).dto.distrito).toBe('Valle Central');
  });

  it('rechaza un distrito que no está en la lista, indicando los ids válidos', async () => {
    const { errores } = await validar({ name: 'X', distrito: 'Atacama' });
    expect(errores).toEqual(['distrito must be one of: norte, metropolitano, valle-central, biobio, araucania, los-rios']);
  });
});
