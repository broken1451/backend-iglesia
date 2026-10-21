import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AccionHistorial, Historial, SeccionHistorial } from './entities/historial.entity.js';
import { Auth } from '../auth/entities/auth.entity.js';
import { capitalizar } from '../common/utils/texto.utils.js';

/** Lo que se anota de un cambio. */
export interface Cambio {
  accion: AccionHistorial;
  seccion: SeccionHistorial;
  /** El registro que cambió (basta con que tenga _id). */
  registro: { _id: Types.ObjectId };
  titulo: string;
  /** Quién lo hizo; null o undefined si fue sin sesión. */
  usuario?: { _id: Types.ObjectId } | null;
}

/**
 * Cómo se cuenta cada acción, por sección. `{t}` es el título del registro.
 * Ej: editar + iglesias → "actualizó la ficha de Luz de Esperanza".
 */
const FRASES: Record<SeccionHistorial, Record<AccionHistorial, string>> = {
  iglesias: {
    crear: 'agregó la iglesia {t}',
    editar: 'actualizó la ficha de {t}',
    publicar: 'publicó la iglesia {t}',
    desactivar: 'desactivó la iglesia {t}',
    reactivar: 'reactivó la iglesia {t}',
  },
  actividades: {
    crear: 'creó la actividad “{t}”',
    editar: 'actualizó la actividad “{t}”',
    publicar: 'publicó la actividad “{t}”',
    desactivar: 'desactivó la actividad “{t}”',
    reactivar: 'reactivó la actividad “{t}”',
  },
  noticias: {
    crear: 'creó el borrador “{t}”',
    editar: 'editó la noticia “{t}”',
    publicar: 'publicó la noticia “{t}”',
    desactivar: 'desactivó la noticia “{t}”',
    reactivar: 'reactivó la noticia “{t}”',
  },
};

/**
 * Historial de cambios del panel: los servicios de iglesias, actividades y noticias anotan
 * cada cambio, y el Resumen muestra los últimos ("Actividad reciente").
 */
@Injectable()
export class HistorialService {
  private readonly logger = new Logger(HistorialService.name);

  /** @param historialModel modelo de Mongo del historial */
  constructor(@InjectModel(Historial.name) private readonly historialModel: Model<Historial>) {}

  /**
   * Anota un cambio. Nunca lanza error: si el historial falla, el cambio en sí ya se guardó
   * y no debe responder 500 por esto; solo queda el aviso en el log.
   */
  async anotar({ accion, seccion, registro, titulo, usuario }: Cambio) {
    try {
      await this.historialModel.create({ accion, seccion, registro: registro._id, titulo, usuario: usuario?._id });
    } catch (error) {
      this.logger.warn(`No se pudo anotar "${accion} ${seccion} ${titulo}": ${String(error)}`);
    }
  }

  /**
   * Los últimos cambios de las secciones indicadas, del más nuevo al más viejo.
   *
   * @param secciones solo estas (las que el usuario ve en el menú)
   * @param limit     cuántos
   * @returns [{ fecha, texto, accion, seccion, registro, titulo }], con texto armado:
   *          "Ana Rojas actualizó la ficha de Luz de Esperanza"
   */
  async recientes(secciones: readonly SeccionHistorial[], limit: number) {
    if (!secciones.length) return [];
    const lineas = await this.historialModel
      .find({ seccion: { $in: secciones } })
      .sort({ created_at: -1 })
      .limit(limit)
      .populate<{ usuario: Pick<Auth, 'name' | 'last_name'> | null }>({ path: 'usuario', select: 'name last_name' })
      .lean();

    return lineas.map((linea) => ({
      fecha: linea.created_at,
      texto: `${quien(linea.usuario)} ${FRASES[linea.seccion][linea.accion].replace('{t}', linea.titulo)}`,
      accion: linea.accion,
      seccion: linea.seccion,
      registro: linea.registro as Types.ObjectId,
      titulo: linea.titulo,
    }));
  }
}

/** "Ana Rojas" (los nombres se guardan en minúsculas), o quién fue si no hay usuario. */
const quien = (usuario: Pick<Auth, 'name' | 'last_name'> | null | undefined) =>
  usuario ? capitalizar(`${usuario.name} ${usuario.last_name}`) : 'Alguien sin sesión';

/**
 * Qué acción anotar al editar, según cómo cambió isActive (y publicado, en noticias).
 * Desactivar o reactivar pesa más que una edición común; publicar, más que editar.
 */
export const accionAlEditar = (
  antes: { isActive: boolean; publicado?: boolean },
  despues: { isActive: boolean; publicado?: boolean },
) => {
  if (antes.isActive && !despues.isActive) return AccionHistorial.desactivar;
  if (!antes.isActive && despues.isActive) return AccionHistorial.reactivar;
  if (!antes.publicado && despues.publicado) return AccionHistorial.publicar;
  return AccionHistorial.editar;
};
