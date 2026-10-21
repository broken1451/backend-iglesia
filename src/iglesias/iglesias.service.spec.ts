import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { IglesiasService } from './iglesias.service.js';
import { Iglesia } from './entities/iglesia.entity.js';
import { HistorialService } from '../historial/historial.service.js';

// Modelo de Mongoose falso: find() devuelve una cadena .sort().skip().limit()
const createModelMock = () => {
  const query = { sort: vi.fn(), skip: vi.fn(), limit: vi.fn().mockResolvedValue([]) };
  query.sort.mockReturnValue(query);
  query.skip.mockReturnValue(query);
  return {
    query,
    find: vi.fn().mockReturnValue(query),
    countDocuments: vi.fn().mockResolvedValue(0),
    findOne: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    aggregate: vi.fn(),
  };
};

describe('IglesiasService', () => {
  let service: IglesiasService;
  let model: ReturnType<typeof createModelMock>;
  // Historial falso: solo registra qué se anotó
  const historial = { anotar: vi.fn() };

  beforeEach(async () => {
    model = createModelMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IglesiasService,
        { provide: getModelToken(Iglesia.name), useValue: model },
        { provide: HistorialService, useValue: historial },
      ],
    }).compile();

    service = module.get<IglesiasService>(IglesiasService);
  });

  describe('findAll', () => {
    it('un visitante solo ve activas aunque pida ?isActive=false', async () => {
      await service.findAll({ isActive: false }, false);
      expect(model.find).toHaveBeenCalledWith({ isActive: true });
    });

    it('el panel puede pedir las desactivadas', async () => {
      await service.findAll({ isActive: false }, true);
      expect(model.find).toHaveBeenCalledWith({ isActive: false });
    });

    it('?pendientes: el panel filtra por estado de la ficha; a un visitante se le ignora', async () => {
      const campos = ['direccion', 'reuniones', 'encargado', 'email', 'telefono'];

      await service.findAll({ pendientes: true }, true);
      expect(model.find.mock.calls[0][0]).toEqual({
        isActive: true,
        $and: [{ $or: campos.map((campo) => ({ [campo]: { $in: [null, ''] } })) }],
      });

      await service.findAll({ pendientes: false }, true);
      expect(model.find.mock.calls[1][0]).toEqual({
        isActive: true,
        $and: [{ $and: campos.map((campo) => ({ [campo]: { $nin: [null, ''] } })) }],
      });

      await service.findAll({ pendientes: true }, false);
      expect(model.find.mock.calls[2][0]).toEqual({ isActive: true });
    });

    it('search busca en el nombre o la comuna, sin pisarse con ?pendientes', async () => {
      await service.findAll({ search: 'antofagasta', pendientes: true }, true);
      const { $and } = model.find.mock.calls[0][0];
      expect($and).toHaveLength(2);
      expect($and[0].$or[1].comuna.test('Antofagasta')).toBe(true);
    });

    it('filtra distrito exacto y nombre sin tildes', async () => {
      await service.findAll({ distrito: 'araucania', search: 'concepcion' });
      const filter = model.find.mock.calls[0][0];
      expect(filter.distrito.test('Araucanía')).toBe(true);
      expect(filter.distrito.test('Araucanía Norte')).toBe(false);
      expect(filter.$and[0].$or[0].name.test('Iglesia de Concepción')).toBe(true);
    });

    it('pagina con valores por defecto', async () => {
      const result = await service.findAll({});
      expect(model.query.skip).toHaveBeenCalledWith(0);
      expect(model.query.limit).toHaveBeenCalledWith(20);
      expect(result).toEqual({ total: 0, limit: 20, offset: 0, data: [] });
    });
  });

  describe('findOne', () => {
    it('un visitante no encuentra una iglesia desactivada', async () => {
      model.findOne.mockResolvedValue(null);
      await expect(service.findOne('abc', false)).rejects.toThrow(NotFoundException);
      expect(model.findOne).toHaveBeenCalledWith({ _id: 'abc', isActive: true });
    });

    it('el panel la busca sin filtrar por activa', async () => {
      model.findOne.mockResolvedValue({ name: 'Cerrada' });
      await service.findOne('abc', true);
      expect(model.findOne).toHaveBeenCalledWith({ _id: 'abc' });
    });
  });

  describe('coordenadas', () => {
    it('rechaza crear con lat sin lng', async () => {
      await expect(service.create({ distrito: 'Norte', name: 'X', lat: -33.4 })).rejects.toThrow(BadRequestException);
      expect(model.create).not.toHaveBeenCalled();
    });

    it('rechaza un PATCH que deja media coordenada', async () => {
      model.findById.mockResolvedValue({ lat: undefined, lng: undefined, set: vi.fn(), save: vi.fn().mockResolvedValue(undefined) });
      await expect(service.update('abc', { lat: -33.4 })).rejects.toThrow(BadRequestException);
    });

    it('permite cambiar solo lat si ya tenía lng guardada', async () => {
      const iglesia = { lat: -33, lng: -70, set: vi.fn(), save: vi.fn().mockResolvedValue(undefined) };
      model.findById.mockResolvedValue(iglesia);
      await expect(service.update('abc', { lat: -33.4 })).resolves.toBe(iglesia);
    });

    it('permite borrar la ubicación con ambas en null', async () => {
      const iglesia = { lat: -33, lng: -70, set: vi.fn(), save: vi.fn().mockResolvedValue(undefined) };
      model.findById.mockResolvedValue(iglesia);
      await expect(service.update('abc', { lat: null, lng: null } as never)).resolves.toBe(iglesia);
    });
  });

  it('traduce el índice único duplicado a un 400', async () => {
    model.create.mockRejectedValue(Object.assign(new Error('E11000'), { code: 11000 }));
    await expect(service.create({ distrito: 'Norte', name: 'Central' })).rejects.toThrow(
      'An iglesia with that name already exists in that distrito',
    );
  });

  it('update no pisa campos que no se enviaron', async () => {
    const iglesia = { set: vi.fn(), save: vi.fn().mockResolvedValue(undefined) };
    model.findById.mockResolvedValue(iglesia);
    await service.update('abc', { reuniones: 'Dom 11:00', name: undefined } as never);
    expect(iglesia.set).toHaveBeenCalledWith({ reuniones: 'Dom 11:00' });
  });

  describe('historial', () => {
    const usuario = { _id: 'u1' } as never;

    it('crear anota quién agregó la iglesia', async () => {
      model.create.mockResolvedValue({ _id: 'i1', name: 'Luz de Esperanza' });
      await service.create({ distrito: 'Norte', name: 'Luz de Esperanza' }, usuario);
      expect(historial.anotar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'crear', seccion: 'iglesias', titulo: 'Luz de Esperanza', usuario }),
      );
    });

    it('un PATCH con { isActive: false } se anota como desactivar, no como editar', async () => {
      const iglesia = {
        name: 'Central', isActive: true, save: vi.fn().mockResolvedValue(undefined),
        set(this: { isActive: boolean }, cambios: { isActive?: boolean }) { Object.assign(this, cambios); },
      };
      model.findById.mockResolvedValue(iglesia);
      await service.update('abc', { isActive: false }, usuario);
      expect(historial.anotar).toHaveBeenLastCalledWith(expect.objectContaining({ accion: 'desactivar' }));
    });
  });

  describe('distritos (lista fija)', () => {
    it('devuelve todos los de la lista, de norte a sur, con 0 los que no tienen iglesias', async () => {
      model.aggregate.mockResolvedValue([
        { distrito: 'Araucanía', total: 14 },
        { distrito: 'Norte', total: 2 },
      ]);
      expect(await service.distritos()).toEqual([
        { distrito: 'Norte', total: 2 },
        { distrito: 'Metropolitano', total: 0 },
        { distrito: 'Valle Central', total: 0 },
        { distrito: 'Biobío', total: 0 },
        { distrito: 'Araucanía', total: 14 },
        { distrito: 'Los Ríos', total: 0 },
      ]);
    });

    it('un distrito antiguo que no está en la lista va al final', async () => {
      model.aggregate.mockResolvedValue([{ distrito: 'Austral', total: 1 }]);
      const distritos = await service.distritos();
      expect(distritos.at(-1)).toEqual({ distrito: 'Austral', total: 1 });
      expect(distritos).toHaveLength(7);
    });

    it('el avance por distrito sigue el mismo orden', async () => {
      model.aggregate.mockResolvedValue([{ distrito: 'Los Ríos', iglesias: 6, completas: 0, porcentaje: 0 }]);
      const avance = await service.avancePorDistrito();
      expect(avance.map((fila) => fila.distrito)).toEqual(['Norte', 'Metropolitano', 'Valle Central', 'Biobío', 'Araucanía', 'Los Ríos']);
      expect(avance[0]).toEqual({ distrito: 'Norte', iglesias: 0, completas: 0, porcentaje: 0 });
    });
  });
});
