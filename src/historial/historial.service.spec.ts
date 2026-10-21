import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { HistorialService, accionAlEditar } from './historial.service.js';
import { AccionHistorial, Historial } from './entities/historial.entity.js';

describe('HistorialService', () => {
  let service: HistorialService;
  // find().sort().limit().populate().lean() devuelve `lineas`
  let lineas: object[];
  const model = {
    create: vi.fn(),
    find: vi.fn(() => {
      const query = { sort: () => query, limit: () => query, populate: () => query, lean: () => Promise.resolve(lineas) };
      return query;
    }),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    lineas = [];
    const module = await Test.createTestingModule({
      providers: [HistorialService, { provide: getModelToken(Historial.name), useValue: model }],
    }).compile();
    service = module.get(HistorialService);
  });

  it('arma el texto de cada línea, con el nombre en mayúscula inicial', async () => {
    lineas = [
      { accion: 'editar', seccion: 'iglesias', titulo: 'Luz de Esperanza', usuario: { name: 'ana', last_name: 'rojas' }, created_at: new Date() },
      { accion: 'publicar', seccion: 'noticias', titulo: 'Unánimes a una oración', usuario: null, created_at: new Date() },
    ];
    const recientes = await service.recientes(['iglesias', 'noticias'], 5);
    expect(recientes.map((linea) => linea.texto)).toEqual([
      'Ana Rojas actualizó la ficha de Luz de Esperanza',
      'Alguien sin sesión publicó la noticia “Unánimes a una oración”',
    ]);
  });

  it('sin secciones visibles no consulta', async () => {
    expect(await service.recientes([], 5)).toEqual([]);
    expect(model.find).not.toHaveBeenCalled();
  });

  it('si no puede anotar, no lanza error (el cambio ya se guardó)', async () => {
    model.create.mockRejectedValue(new Error('Mongo caído'));
    await expect(
      service.anotar({ accion: AccionHistorial.crear, seccion: 'iglesias', registro: { _id: 'x' } as never, titulo: 'X' }),
    ).resolves.toBeUndefined();
  });

  it('accionAlEditar: desactivar y reactivar pesan más que editar; publicar también', () => {
    expect(accionAlEditar({ isActive: true }, { isActive: false })).toBe('desactivar');
    expect(accionAlEditar({ isActive: false }, { isActive: true })).toBe('reactivar');
    expect(accionAlEditar({ isActive: true, publicado: false }, { isActive: true, publicado: true })).toBe('publicar');
    expect(accionAlEditar({ isActive: true, publicado: true }, { isActive: true, publicado: true })).toBe('editar');
  });
});
