import { Injectable } from '@nestjs/common';
import { IglesiasService } from '../iglesias/iglesias.service.js';
import { ActividadesService } from '../actividades/actividades.service.js';
import { NoticiasService } from '../noticias/noticias.service.js';
import { MensajesService } from '../mensajes/mensajes.service.js';
import { HistorialService } from '../historial/historial.service.js';
import { SECCIONES_HISTORIAL } from '../historial/entities/historial.entity.js';
import { CAMPOS_FICHA_IGLESIA } from '../iglesias/entities/iglesia.entity.js';
import { CAMPOS_FICHA_ACTIVIDAD } from '../actividades/entities/actividad.entity.js';
import { MENU, getAccesosRapidos, hasMenuAccess, puedeEditar } from '../auth/menu/menu.config.js';
import { Auth } from '../auth/entities/auth.entity.js';
import { nombrarCampos } from '../common/utils/pendientes.utils.js';

/** Cuántos borradores se muestran uno por uno; del resto se muestra una sola tarea. */
const BORRADORES_VISIBLES = 3;

/** Cuántas líneas trae "Actividad reciente". */
const ACTIVIDAD_RECIENTE = 5;

/** Una tarjeta del recuadro "Por hacer". */
export interface TareaPorHacer {
  /** Qué tipo de tarea es, para que el front pueda tratarla distinto si quiere. */
  tipo: 'completar-iglesias' | 'completar-actividades' | 'responder-mensajes' | 'terminar-borrador' | 'revisar-borradores';
  /** Sección del menú a la que pertenece (clave de MENU). */
  seccion: 'iglesias' | 'actividades' | 'mensajes' | 'noticias';
  /** Ícono de la sección (el mismo del menú). */
  icono: string;
  /** Texto principal: "Completar 48 fichas de iglesia". */
  titulo: string;
  /** Texto secundario: "Dirección, horario, pastor, correo y teléfono ayudan a que las visiten". */
  detalle: string;
  /** A cuántos registros se refiere. */
  cantidad: number;
  /**
   * Adónde lleva el botón "Ir": la ruta de la sección en el panel (MENU.x.ruta) con los
   * mismos filtros que acepta la API, ej. "iglesias?pendientes=true" o "noticias/6ad7...".
   */
  ruta: string;
  /** Id del registro, solo en las tareas de un registro puntual (un borrador). */
  id?: string;
}

/** "1 ficha" / "48 fichas". */
const plural = (cantidad: number, singular: string, plural: string) => `${cantidad} ${cantidad === 1 ? singular : plural}`;

/**
 * La fecha de hoy en Chile, "2026-10-20". toISOString() daría la fecha UTC, que desde las
 * 21:00 de Chile ya es mañana. en-CA es el idioma que formatea como AAAA-MM-DD.
 */
const hoyEnChile = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());

/** "Dirección, horario, pastor, correo y teléfono" (los datos de una ficha de iglesia completa). */
const DATOS_FICHA = nombrarCampos(CAMPOS_FICHA_IGLESIA);

/**
 * Arma la pantalla Resumen del panel: tarjetas de números, "Por hacer", accesos rápidos,
 * actividad reciente y avance de fichas por distrito.
 *
 * No tiene datos propios: consulta a los servicios de cada sección. Cada bloque depende
 * del rol: lo que el usuario no ve en el menú llega como null (el front lo oculta), y el
 * "Por hacer" solo propone lo que el usuario puede resolver (puedeEditar).
 */
@Injectable()
export class ResumenService {
  constructor(
    private readonly iglesiasService: IglesiasService,
    private readonly actividadesService: ActividadesService,
    private readonly noticiasService: NoticiasService,
    private readonly mensajesService: MensajesService,
    private readonly historialService: HistorialService,
  ) {}

  /**
   * Toda la pantalla en un solo request. Las consultas van en paralelo, y la de una sección
   * que el usuario no ve ni se hace.
   *
   * @returns { tarjetas, porHacer, accesosRapidos, actividadReciente, avanceDistritos }
   */
  async resumen(user: Auth) {
    const ve = (seccion: keyof typeof MENU) => hasMenuAccess(user, seccion);

    const [distritos, mensajes, actividades, noticias, porHacer, actividadReciente] = await Promise.all([
      ve('iglesias') ? this.iglesiasService.avancePorDistrito() : null,
      ve('mensajes') ? this.mensajesService.contar() : null,
      ve('actividades') ? this.actividadesService.proximas() : null,
      ve('noticias') ? this.noticiasService.contar() : null,
      this.porHacer(user),
      // Solo los cambios de las secciones que ve
      this.historialService.recientes(SECCIONES_HISTORIAL.filter(ve), ACTIVIDAD_RECIENTE),
    ]);

    return {
      tarjetas: {
        fichas: distritos && this.fichas(distritos),
        mensajes,
        actividades,
        noticias,
      },
      porHacer,
      accesosRapidos: getAccesosRapidos(user),
      actividadReciente,
      avanceDistritos: distritos && {
        detalle: `Cada ficha completa tiene ${CAMPOS_FICHA_IGLESIA.length} datos: ${DATOS_FICHA.toLowerCase()}.`,
        distritos: distritos.map(({ distrito, iglesias, porcentaje }) => ({ distrito, iglesias, porcentaje })),
      },
    };
  }

  /**
   * Tarjeta "Fichas completas: 0 de 48", sumando los distritos.
   * porcentaje es el de la barra: fichas completas sobre el total.
   */
  private fichas(distritos: { iglesias: number; completas: number }[]) {
    const total = distritos.reduce((suma, fila) => suma + fila.iglesias, 0);
    const completas = distritos.reduce((suma, fila) => suma + fila.completas, 0);
    return {
      completas,
      total,
      porcentaje: total ? Math.round((completas / total) * 100) : 0,
      detalle: `Con ${DATOS_FICHA.toLowerCase()}`,
    };
  }

  /**
   * Solo el recuadro "Por hacer" (también lo expone GET /api/resumen/por-hacer).
   * @returns { total, items } — total es la cantidad de tarjetas (el número del recuadro)
   */
  async porHacer(user: Auth) {
    // En el orden del diseño; la consulta de una sección que el usuario no edita ni se hace
    const grupos = await Promise.all([
      puedeEditar(user, 'iglesias') ? this.fichasIglesia() : [],
      puedeEditar(user, 'actividades') ? this.fichasActividad() : [],
      puedeEditar(user, 'mensajes') ? this.mensajesSinLeer() : [],
      puedeEditar(user, 'noticias') ? this.borradores() : [],
    ]);
    const items = grupos.flat();
    return { total: items.length, items };
  }

  /** "Completar 48 fichas de iglesia": iglesias activas a las que les falta algún dato. */
  private async fichasIglesia(): Promise<TareaPorHacer[]> {
    const cantidad = await this.iglesiasService.contarIncompletas();
    if (!cantidad) return [];
    return [{
      tipo: 'completar-iglesias',
      seccion: 'iglesias',
      icono: MENU.iglesias.icono,
      titulo: `Completar ${plural(cantidad, 'ficha', 'fichas')} de iglesia`,
      detalle: `${DATOS_FICHA} ayudan a que las visiten`,
      cantidad,
      ruta: `${MENU.iglesias.ruta}?pendientes=true`,
    }];
  }

  /** "Completar 2 actividades próximas": por venir o en curso, sin descripción o lugar. */
  private async fichasActividad(): Promise<TareaPorHacer[]> {
    const cantidad = await this.actividadesService.contarIncompletas();
    if (!cantidad) return [];
    return [{
      tipo: 'completar-actividades',
      seccion: 'actividades',
      icono: MENU.actividades.icono,
      titulo: `Completar ${plural(cantidad, 'actividad próxima', 'actividades próximas')}`,
      detalle: `${nombrarCampos(CAMPOS_FICHA_ACTIVIDAD)} ayudan a que se sumen más personas`,
      cantidad,
      ruta: `${MENU.actividades.ruta}?pendientes=true&desde=${hoyEnChile()}`,
    }];
  }

  /** "Responder 3 mensajes · Recibidos desde el sitio": los sin leer. */
  private async mensajesSinLeer(): Promise<TareaPorHacer[]> {
    const { sinLeer } = await this.mensajesService.contar();
    if (!sinLeer) return [];
    return [{
      tipo: 'responder-mensajes',
      seccion: 'mensajes',
      icono: MENU.mensajes.icono,
      titulo: `Responder ${plural(sinLeer, 'mensaje', 'mensajes')}`,
      detalle: 'Recibidos desde el sitio',
      cantidad: sinLeer,
      ruta: `${MENU.mensajes.ruta}?leido=false`,
    }];
  }

  /**
   * Una tarjeta por borrador ("Terminar el borrador de noticia" + su título), los últimos
   * editados primero. Si hay más de BORRADORES_VISIBLES, el resto va en una sola tarjeta.
   */
  private async borradores(): Promise<TareaPorHacer[]> {
    const { total, data } = await this.noticiasService.borradores(BORRADORES_VISIBLES);
    const tareas: TareaPorHacer[] = data.map((noticia) => ({
      tipo: 'terminar-borrador',
      seccion: 'noticias',
      icono: MENU.noticias.icono,
      titulo: 'Terminar el borrador de noticia',
      detalle: noticia.titulo,
      cantidad: 1,
      ruta: `${MENU.noticias.ruta}/${String(noticia._id)}`,
      id: String(noticia._id),
    }));

    const resto = total - data.length;
    if (resto > 0) {
      tareas.push({
        tipo: 'revisar-borradores',
        seccion: 'noticias',
        icono: MENU.noticias.icono,
        titulo: `Revisar ${plural(resto, 'borrador más', 'borradores más')}`,
        detalle: 'Noticias sin publicar',
        cantidad: resto,
        ruta: `${MENU.noticias.ruta}?publicado=false`,
      });
    }
    return tareas;
  }
}
