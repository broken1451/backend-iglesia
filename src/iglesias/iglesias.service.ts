import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, type QueryFilter } from 'mongoose';
import { CreateIglesiaDto } from './dto/create-iglesia.dto.js';
import { UpdateIglesiaDto } from './dto/update-iglesia.dto.js';
import { FindIglesiasDto } from './dto/find-iglesias.dto.js';
import { CAMPOS_FICHA_IGLESIA, Iglesia } from './entities/iglesia.entity.js';
import { faltaAlguno, tieneTodos } from '../common/utils/pendientes.utils.js';
import { ordenarPorDistrito } from './distritos.js';
import { HistorialService, accionAlEditar } from '../historial/historial.service.js';
import { AccionHistorial } from '../historial/entities/historial.entity.js';
import type { Auth } from '../auth/entities/auth.entity.js';
import { containsRegex, definedOnly, equalsRegex, paginated, rethrowDuplicate } from '../common/utils/mongo.utils.js';

/** Mensaje del 400 cuando se repite nombre + distrito (índice único de la entidad). */
const DUPLICATE = 'An iglesia with that name already exists in that distrito';

/**
 * Lógica del directorio de iglesias: consultas a Mongo y reglas de negocio.
 * No sabe de roles: el controller le indica si quien consulta puede ver las desactivadas.
 */
@Injectable()
export class IglesiasService {

  /**
   * @param iglesiaModel modelo de Mongo de las iglesias
   * @param historial    anota cada cambio para "Actividad reciente" del panel
   */
  constructor(
    @InjectModel(Iglesia.name) private readonly iglesiaModel: Model<Iglesia>,
    private readonly historial: HistorialService,
  ) {}

  /**
   * Crea una iglesia.
   * @returns la iglesia creada
   * @throws BadRequestException (400) si viene lat sin lng (o al revés),
   *         o si ya existe una iglesia con ese nombre en ese distrito
   */
  async create(createIglesiaDto: CreateIglesiaDto, usuario?: Auth | null) {
    checkCoordenadas(createIglesiaDto.lat, createIglesiaDto.lng);
    const iglesia = await this.iglesiaModel.create(createIglesiaDto).catch((error: unknown) => rethrowDuplicate(error, DUPLICATE));
    await this.historial.anotar({ accion: AccionHistorial.crear, seccion: 'iglesias', registro: iglesia, titulo: iglesia.name, usuario });
    return iglesia;
  }

  /**
   * Lista paginada de iglesias, ordenada por distrito y luego por nombre.
   *
   * @param query        filtros: distrito (exacto), search (en el nombre o la comuna), isActive,
   *                     pendientes (true = fichas incompletas, false = completas), limit, offset.
   *                     distrito y search no distinguen mayúsculas ni tildes.
   * @param verInactivas true solo para roles que gestionan iglesias. Si es false, siempre
   *                     devuelve solo activas aunque se pida ?isActive=false; así un visitante
   *                     no puede ver lo desactivado manipulando la URL.
   * @returns { total, limit, offset, data }
   */
  async findAll({ distrito, search, isActive, pendientes, limit = 20, offset = 0 }: FindIglesiasDto, verInactivas = false) {
    // Quien no gestiona iglesias solo ve las activas, pida lo que pida en ?isActive=
    const filter: QueryFilter<Iglesia> = { isActive: verInactivas ? (isActive ?? true) : true };
    if (distrito) filter.distrito = equalsRegex(distrito);
    // Condiciones con $or / $and propios van en una lista $and, para que una no pise a la otra
    const condiciones: QueryFilter<Iglesia>[] = [];
    if (search) condiciones.push({ $or: [{ name: containsRegex(search) }, { comuna: containsRegex(search) }] });
    // Estado de la ficha (solo panel): true = incompletas (botón "Ir" del Por hacer), false = completas
    if (pendientes !== undefined && verInactivas) {
      condiciones.push(pendientes ? faltaAlguno(CAMPOS_FICHA_IGLESIA) : tieneTodos(CAMPOS_FICHA_IGLESIA));
    }
    if (condiciones.length) filter.$and = condiciones;

    // La página y el total se piden a la vez para no esperar dos viajes a Mongo
    const [data, total] = await Promise.all([
      this.iglesiaModel.find(filter).sort({ distrito: 1, name: 1 }).skip(offset).limit(limit),
      this.iglesiaModel.countDocuments(filter),
    ]);
    return paginated(data, total, limit, offset);
  }

  /**
   * Los distritos de la lista fija con cuántas iglesias activas tiene cada uno.
   * - El selector "Distrito" del formulario del panel usa la lista completa.
   * - El filtro del sitio puede ocultar los de total 0.
   * Si en la base hay distritos fuera de la lista (datos antiguos), van al final.
   *
   * @returns [{ distrito: "Norte", total: 2 }, { distrito: "Metropolitano", total: 0 }, ...]
   *          en el orden de DISTRITOS (de norte a sur)
   */
  async distritos() {
    const filas = await this.iglesiaModel.aggregate<{ distrito: string; total: number }>([
      { $match: { isActive: true } },                               // solo activas
      { $group: { _id: '$distrito', total: { $sum: 1 } } },          // una fila por distrito, contando
      { $project: { _id: 0, distrito: '$_id', total: 1 } },          // renombra _id → distrito
    ]);
    // Todos los de la lista fija, en su orden (los sin iglesias, con total 0). El map deja
    // las claves siempre en el mismo orden (Mongo pone primero "total")
    return ordenarPorDistrito(filas, (distrito) => ({ distrito, total: 0 })).map(({ distrito, total }) => ({ distrito, total }));
  }

  /**
   * Cuántas iglesias activas tienen la ficha incompleta (les falta algún dato de
   * CAMPOS_FICHA_IGLESIA). Lo usa el "Por hacer" del panel (ResumenService).
   */
  contarIncompletas() {
    return this.iglesiaModel.countDocuments({ isActive: true, ...faltaAlguno(CAMPOS_FICHA_IGLESIA) });
  }

  /**
   * Avance de las fichas por distrito, para el Resumen del panel ("Fichas completas" y
   * "Avance de fichas por distrito"). Solo iglesias activas.
   *
   * porcentaje = datos llenos / datos posibles. Ej: 5 iglesias × 5 datos = 25 posibles; con
   * 3 llenos, 12%. Así una ficha a medias también suma avance, no solo las completas.
   *
   * @returns [{ distrito: "Araucanía", iglesias: 14, completas: 2, porcentaje: 31 }, ...]
   *          en el orden de DISTRITOS (los sin iglesias, en 0)
   */
  async avancePorDistrito() {
    const campos = CAMPOS_FICHA_IGLESIA.length;
    // 1 si el campo tiene valor, 0 si no existe, es null o es ""
    const lleno = (campo: string) => ({ $cond: [{ $eq: [{ $ifNull: [`$${campo}`, ''] }, ''] }, 0, 1] });

    const filas = await this.iglesiaModel.aggregate<{ distrito: string; iglesias: number; completas: number; porcentaje: number }>([
      { $match: { isActive: true } },
      // Por iglesia: cuántos de los 5 datos tiene
      { $project: { distrito: 1, llenos: { $add: CAMPOS_FICHA_IGLESIA.map(lleno) } } },
      // Por distrito: iglesias, fichas completas y datos llenos en total
      {
        $group: {
          _id: '$distrito',
          iglesias: { $sum: 1 },
          completas: { $sum: { $cond: [{ $eq: ['$llenos', campos] }, 1, 0] } },
          llenos: { $sum: '$llenos' },
        },
      },
      {
        $project: {
          _id: 0,
          distrito: '$_id',
          iglesias: 1,
          completas: 1,
          porcentaje: { $round: [{ $multiply: [{ $divide: ['$llenos', { $multiply: ['$iglesias', campos] }] }, 100] }, 0] },
        },
      },
    ]);
    // En el orden de la lista fija (de norte a sur), con los distritos sin iglesias en 0
    return ordenarPorDistrito(filas, (distrito) => ({ distrito, iglesias: 0, completas: 0, porcentaje: 0 }));
  }

  /**
   * Una iglesia por id.
   * @param verInactivas si es false (visitantes), una iglesia desactivada responde 404
   *                     como si no existiera
   * @throws NotFoundException (404) si no existe (o está desactivada y no puede verla)
   */
  async findOne(id: string, verInactivas = false) {
    // Una iglesia desactivada consultada por un visitante responde 404
    const filter: QueryFilter<Iglesia> = { _id: id, ...(!verInactivas && { isActive: true }) };
    const iglesia = await this.iglesiaModel.findOne(filter);
    if (!iglesia) throw new NotFoundException(`Iglesia with id ${id} not found`);
    return iglesia;
  }

  /**
   * Edita una iglesia. Solo cambia los campos que vienen en el body.
   * También sirve para reactivarla con { "isActive": true }.
   *
   * Se usa findById + save (y no findByIdAndUpdate) para poder validar las coordenadas
   * contra lo que ya está guardado antes de escribir.
   *
   * @returns la iglesia actualizada
   * @throws NotFoundException (404) si no existe
   * @throws BadRequestException (400) si quedaría media coordenada, o nombre duplicado en el distrito
   */
  async update(id: string, updateIglesiaDto: UpdateIglesiaDto, usuario?: Auth | null) {
    // Sin filtro isActive: así un ADMIN puede reactivar una iglesia con { "isActive": true }
    const iglesia = await this.iglesiaModel.findById(id);
    if (!iglesia) throw new NotFoundException(`Iglesia with id ${id} not found`);

    const changes = definedOnly(updateIglesiaDto);
    // Se validan las coordenadas combinando lo guardado con lo nuevo (null borra la ubicación)
    checkCoordenadas(
      'lat' in changes ? changes.lat : iglesia.lat,
      'lng' in changes ? changes.lng : iglesia.lng,
    );

    const antes = { isActive: iglesia.isActive };
    iglesia.set(changes);
    await iglesia.save().catch((error: unknown) => rethrowDuplicate(error, DUPLICATE));
    await this.historial.anotar({ accion: accionAlEditar(antes, iglesia), seccion: 'iglesias', registro: iglesia, titulo: iglesia.name, usuario });
    return iglesia;
  }

  /**
   * Desactiva una iglesia (borrado lógico): deja de verse en el sitio, pero no se pierde
   * y se puede reactivar con PATCH { "isActive": true }.
   * @throws NotFoundException (404) si no existe o ya estaba desactivada
   */
  async remove(id: string, usuario?: Auth | null) {
    // Borrado lógico: deja de aparecer en el sitio pero se puede reactivar
    const iglesia = await this.findOne(id);
    iglesia.isActive = false;
    await iglesia.save();
    await this.historial.anotar({ accion: AccionHistorial.desactivar, seccion: 'iglesias', registro: iglesia, titulo: iglesia.name, usuario });
    return { message: `Iglesia ${id} deactivated` };
  }
}

/**
 * Un punto del mapa necesita las dos coordenadas: o vienen ambas o ninguna.
 * `== null` cubre tanto undefined (no enviada) como null (borrada a propósito).
 * @throws BadRequestException (400) si hay una sin la otra
 */
const checkCoordenadas = (lat?: number | null, lng?: number | null) => {
  if ((lat == null) !== (lng == null)) {
    throw new BadRequestException('lat and lng must be sent together');
  }
};
