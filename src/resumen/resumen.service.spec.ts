import { Test } from '@nestjs/testing';
import { ResumenService } from './resumen.service.js';
import { IglesiasService } from '../iglesias/iglesias.service.js';
import { ActividadesService } from '../actividades/actividades.service.js';
import { NoticiasService } from '../noticias/noticias.service.js';
import { MensajesService } from '../mensajes/mensajes.service.js';
import { HistorialService } from '../historial/historial.service.js';
import { ValidRoles } from '../auth/interfaces/role.enum.js';
import type { Auth } from '../auth/entities/auth.entity.js';

const usuario = (...roles: ValidRoles[]) => ({ roles }) as unknown as Auth;
const borrador = (n: number) => ({ _id: `id${n}`, titulo: `Borrador ${n}` });

describe('ResumenService', () => {
  let service: ResumenService;
  const iglesias = { contarIncompletas: vi.fn(), avancePorDistrito: vi.fn() };
  const actividades = { contarIncompletas: vi.fn(), proximas: vi.fn() };
  const noticias = { borradores: vi.fn(), contar: vi.fn() };
  const mensajes = { contar: vi.fn() };
  const historial = { recientes: vi.fn() };

  beforeEach(async () => {
    iglesias.contarIncompletas.mockResolvedValue(48);
    iglesias.avancePorDistrito.mockResolvedValue([
      { distrito: 'Araucanía', iglesias: 14, completas: 0, porcentaje: 0 },
      { distrito: 'Valle Central', iglesias: 5, completas: 1, porcentaje: 12 },
    ]);
    actividades.contarIncompletas.mockResolvedValue(1);
    actividades.proximas.mockResolvedValue({ proximas: 6, inscritos: 105 });
    noticias.borradores.mockResolvedValue({ total: 1, data: [borrador(1)] });
    noticias.contar.mockResolvedValue({ publicadas: 4, borradores: 1 });
    mensajes.contar.mockResolvedValue({ total: 4, sinLeer: 3 });
    historial.recientes.mockResolvedValue([{ texto: 'Ana Rojas publicó la noticia “Unánimes a una oración”' }]);

    const module = await Test.createTestingModule({
      providers: [
        ResumenService,
        { provide: IglesiasService, useValue: iglesias },
        { provide: ActividadesService, useValue: actividades },
        { provide: NoticiasService, useValue: noticias },
        { provide: MensajesService, useValue: mensajes },
        { provide: HistorialService, useValue: historial },
      ],
    }).compile();
    service = module.get(ResumenService);
  });

  afterEach(() => vi.clearAllMocks());

  describe('resumen (toda la pantalla)', () => {
    it('ADMIN recibe todas las tarjetas con los números del diseño', async () => {
      const { tarjetas, avanceDistritos, accesosRapidos, actividadReciente } = await service.resumen(usuario(ValidRoles.admin));

      expect(tarjetas).toEqual({
        fichas: { completas: 1, total: 19, porcentaje: 5, detalle: 'Con dirección, horario, pastor, correo y teléfono' },
        mensajes: { total: 4, sinLeer: 3 },
        actividades: { proximas: 6, inscritos: 105 },
        noticias: { publicadas: 4, borradores: 1 },
      });
      expect(avanceDistritos).toEqual({
        detalle: 'Cada ficha completa tiene 5 datos: dirección, horario, pastor, correo y teléfono.',
        distritos: [
          { distrito: 'Araucanía', iglesias: 14, porcentaje: 0 },
          { distrito: 'Valle Central', iglesias: 5, porcentaje: 12 },
        ],
      });
      expect(accesosRapidos.map((acceso) => acceso.titulo)).toEqual([
        'Publicar noticia', 'Crear actividad', 'Actualizar proyectos', 'Programar devocional',
      ]);
      expect(accesosRapidos[0]).toEqual({ titulo: 'Publicar noticia', icono: 'diario', ruta: 'noticias/nueva' });
      expect(actividadReciente).toHaveLength(1);
      expect(historial.recientes).toHaveBeenCalledWith(['iglesias', 'actividades', 'noticias'], 5);
    });

    it('lo que el rol no ve en el menú llega como null (y no se consulta)', async () => {
      const { tarjetas, avanceDistritos, accesosRapidos } = await service.resumen(usuario(ValidRoles.distrito));

      expect(tarjetas.noticias).toBeNull();
      expect(tarjetas.fichas).not.toBeNull();
      expect(avanceDistritos).not.toBeNull();
      expect(noticias.contar).not.toHaveBeenCalled();
      expect(accesosRapidos.map((acceso) => acceso.titulo)).toEqual(['Crear actividad']);
      expect(historial.recientes).toHaveBeenCalledWith(['iglesias', 'actividades'], 5);
    });

    it('IGLESIA ve las fichas, pero no tiene accesos rápidos ni tareas', async () => {
      const resumen = await service.resumen(usuario(ValidRoles.iglesia));
      expect(resumen.tarjetas.fichas).not.toBeNull();
      expect(resumen.accesosRapidos).toEqual([]);
      expect(resumen.porHacer.items.map((item) => item.tipo)).toEqual(['responder-mensajes']);
    });
  });

  describe('porHacer', () => {
    it('ADMIN recibe las tareas de todas las secciones, con el texto del panel', async () => {
      const { total, items } = await service.porHacer(usuario(ValidRoles.admin));
      expect(total).toBe(4);
      expect(items[0]).toMatchObject({
        tipo: 'completar-iglesias',
        icono: 'templo',
        titulo: 'Completar 48 fichas de iglesia',
        detalle: 'Dirección, horario, pastor, correo y teléfono ayudan a que las visiten',
        cantidad: 48,
        ruta: 'iglesias?pendientes=true',
      });
      expect(items[1].titulo).toBe('Completar 1 actividad próxima');
      expect(items[2]).toMatchObject({ titulo: 'Responder 3 mensajes', detalle: 'Recibidos desde el sitio', ruta: 'mensajes?leido=false' });
      expect(items[3]).toMatchObject({ tipo: 'terminar-borrador', detalle: 'Borrador 1', ruta: 'noticias/id1', id: 'id1' });
    });

    it('cada rol recibe solo lo que puede resolver (y ni se consulta lo demás)', async () => {
      const { items } = await service.porHacer(usuario(ValidRoles.comunicaciones));
      expect(items.map((item) => item.seccion)).toEqual(['actividades', 'mensajes', 'noticias']);
      expect(iglesias.contarIncompletas).not.toHaveBeenCalled();
    });

    it('una sección sin pendientes no genera tarjeta', async () => {
      iglesias.contarIncompletas.mockResolvedValue(0);
      mensajes.contar.mockResolvedValue({ total: 4, sinLeer: 0 });
      const { items } = await service.porHacer(usuario(ValidRoles.distrito));
      expect(items.map((item) => item.tipo)).toEqual(['completar-actividades']);
    });

    it('más de 3 borradores: 3 tarjetas sueltas y una con el resto', async () => {
      noticias.borradores.mockResolvedValue({ total: 5, data: [borrador(1), borrador(2), borrador(3)] });
      const { items } = await service.porHacer(usuario(ValidRoles.comunicaciones));
      expect(items.filter((item) => item.tipo === 'terminar-borrador')).toHaveLength(3);
      expect(items.at(-1)).toMatchObject({ tipo: 'revisar-borradores', titulo: 'Revisar 2 borradores más', ruta: 'noticias?publicado=false' });
    });
  });
});
