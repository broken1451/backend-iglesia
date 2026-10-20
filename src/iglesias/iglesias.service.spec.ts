import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { IglesiasService } from './iglesias.service.js';
import { Iglesia } from './entities/iglesia.entity.js';

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
  };
};

describe('IglesiasService', () => {
  let service: IglesiasService;
  let model: ReturnType<typeof createModelMock>;

  beforeEach(async () => {
    model = createModelMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [IglesiasService, { provide: getModelToken(Iglesia.name), useValue: model }],
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

    it('filtra distrito exacto y nombre sin tildes', async () => {
      await service.findAll({ distrito: 'araucania', search: 'concepcion' });
      const filter = model.find.mock.calls[0][0];
      expect(filter.distrito.test('Araucanía')).toBe(true);
      expect(filter.distrito.test('Araucanía Norte')).toBe(false);
      expect(filter.name.test('Iglesia de Concepción')).toBe(true);
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
      model.findById.mockResolvedValue({ lat: undefined, lng: undefined, set: vi.fn(), save: vi.fn() });
      await expect(service.update('abc', { lat: -33.4 })).rejects.toThrow(BadRequestException);
    });

    it('permite cambiar solo lat si ya tenía lng guardada', async () => {
      const iglesia = { lat: -33, lng: -70, set: vi.fn(), save: vi.fn().mockResolvedValue('ok') };
      model.findById.mockResolvedValue(iglesia);
      await expect(service.update('abc', { lat: -33.4 })).resolves.toBe('ok');
    });

    it('permite borrar la ubicación con ambas en null', async () => {
      const iglesia = { lat: -33, lng: -70, set: vi.fn(), save: vi.fn().mockResolvedValue('ok') };
      model.findById.mockResolvedValue(iglesia);
      await expect(service.update('abc', { lat: null, lng: null } as never)).resolves.toBe('ok');
    });
  });

  it('traduce el índice único duplicado a un 400', async () => {
    model.create.mockRejectedValue(Object.assign(new Error('E11000'), { code: 11000 }));
    await expect(service.create({ distrito: 'Norte', name: 'Central' })).rejects.toThrow(
      'An iglesia with that name already exists in that distrito',
    );
  });

  it('update no pisa campos que no se enviaron', async () => {
    const iglesia = { set: vi.fn(), save: vi.fn() };
    model.findById.mockResolvedValue(iglesia);
    await service.update('abc', { reuniones: 'Dom 11:00', name: undefined } as never);
    expect(iglesia.set).toHaveBeenCalledWith({ reuniones: 'Dom 11:00' });
  });
});
