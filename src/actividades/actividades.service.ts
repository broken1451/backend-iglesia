import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, type QueryFilter } from 'mongoose';
import { CreateActividadDto } from './dto/create-actividad.dto.js';
import { UpdateActividadDto } from './dto/update-actividad.dto.js';
import { FindActividadesDto } from './dto/find-actividades.dto.js';
import { Actividad, CAMPOS_FICHA_ACTIVIDAD, DISTRITO_NACIONAL } from './entities/actividad.entity.js';
import { faltaAlguno, tieneTodos } from '../common/utils/pendientes.utils.js';
import { HistorialService, accionAlEditar } from '../historial/historial.service.js';
import { AccionHistorial } from '../historial/entities/historial.entity.js';
import type { Auth } from '../auth/entities/auth.entity.js';
import { containsRegex, definedOnly, equalsRegex, paginated } from '../common/utils/mongo.utils.js';

/**
 * Lógica del calendario de actividades: consultas a Mongo y reglas de negocio.
 * No sabe de roles: el controller le indica si quien consulta puede ver las desactivadas.
 */
@Injectable()
export class ActividadesService {

  /**
   * @param actividadModel modelo de Mongo de las actividades
   * @param historial      anota cada cambio para "Actividad reciente" del panel
   */
  constructor(
    @InjectModel(Actividad.name) private readonly actividadModel: Model<Actividad>,
    private readonly historial: HistorialService,
  ) {}

  /**
   * Crea una actividad. Si no viene distrito (o viene vacío), queda como "Nacional".
   * @returns la actividad creada
   * @throws BadRequestException (400) si fecha_fin es anterior a fecha_inicio
   */
  async create(createActividadDto: CreateActividadDto, usuario?: Auth | null) {
    checkFechas(createActividadDto.fecha_inicio, createActividadDto.fecha_fin);
    const actividad = await this.actividadModel.create({
      ...definedOnly(createActividadDto),
      distrito: createActividadDto.distrito?.trim() || DISTRITO_NACIONAL,
    });
    await this.historial.anotar({ accion: AccionHistorial.crear, seccion: 'actividades', registro: actividad, titulo: actividad.titulo, usuario });
    return actividad;
  }

  /**
   * Lista paginada de actividades.
   *
   * @param query filtros:
   *   - desde: actividades que siguen vigentes desde esa fecha (incluye las que
   *     empezaron antes y aún no terminan, como el 2º día de un retiro). Con solo
   *     el día, desde las 00:00 de ese día en hora de Chile
   *   - hasta: actividades que empiezan hasta esa fecha (con solo el día, "2026-12-31",
   *     incluye todo ese día en hora de Chile)
   *   - distrito: exacto, sin tildes ni mayúsculas ("Nacional" trae las nacionales)
   *   - search: en el título, sin tildes ni mayúsculas
   *   - pendientes: true = las que tienen datos por completar, false = las completas (solo panel)
   *   - isActive, limit, offset
   * @param verInactivas true solo para roles que gestionan actividades. Si es false,
   *   siempre devuelve solo activas aunque se pida ?isActive=false.
   * @returns { total, limit, offset, data }
   */
  // Ordenadas por fecha: el front las agrupa por mes tal como vienen
  async findAll({ desde, hasta, distrito, search, isActive, pendientes, limit = 20, offset = 0 }: FindActividadesDto, verInactivas = false) {
    // Quien no gestiona actividades solo ve las activas, pida lo que pida en ?isActive=
    const filter: QueryFilter<Actividad> = { isActive: verInactivas ? (isActive ?? true) : true };
    if (distrito) filter.distrito = equalsRegex(distrito);
    if (search) filter.titulo = containsRegex(search);
    if (hasta) filter.fecha_inicio = { $lte: finDelDia(hasta) };
    if (desde) {
      // Sigue vigente si termina después de "desde" (o, sin fecha_fin, si empieza después)
      Object.assign(filter, vigentesDesde(inicioDelDia(desde)));
    }
    // Solo panel: true = incompletas (botón "Ir" del Por hacer), false = completas. Va dentro de
    // $and porque ?desde también usa $or y uno pisaría al otro
    if (pendientes !== undefined && verInactivas) {
      filter.$and = [pendientes ? faltaAlguno(CAMPOS_FICHA_ACTIVIDAD) : tieneTodos(CAMPOS_FICHA_ACTIVIDAD)];
    }

    // La página y el total se piden a la vez para no esperar dos viajes a Mongo
    const [data, total] = await Promise.all([
      this.actividadModel.find(filter).sort({ fecha_inicio: 1 }).skip(offset).limit(limit),
      this.actividadModel.countDocuments(filter),
    ]);
    return paginated(data, total, limit, offset);
  }

  /**
   * Cuántas actividades activas y por venir (o en curso) tienen datos por completar.
   * Las pasadas no cuentan: ya no tiene sentido completarlas. Lo usa el "Por hacer" del panel.
   */
  contarIncompletas() {
    return this.actividadModel.countDocuments({
      isActive: true,
      $and: [vigentesDesde(new Date()), faltaAlguno(CAMPOS_FICHA_ACTIVIDAD)],
    });
  }

  /**
   * Para el Resumen del panel ("6 próximas actividades · 105 personas inscritas"): las
   * actividades activas por venir o en curso, y la suma de sus inscritos.
   * @returns { proximas, inscritos }
   */
  async proximas() {
    const [resultado] = await this.actividadModel.aggregate<{ proximas: number; inscritos: number }>([
      { $match: { isActive: true, ...vigentesDesde(new Date()) } },
      { $group: { _id: null, proximas: { $sum: 1 }, inscritos: { $sum: { $ifNull: ['$inscritos', 0] } } } },
      { $project: { _id: 0, proximas: 1, inscritos: 1 } },
    ]);
    // Sin actividades próximas, el $group no devuelve ninguna fila
    return resultado ?? { proximas: 0, inscritos: 0 };
  }

  /**
   * Una actividad por id.
   * @param verInactivas si es false (visitantes), una desactivada responde 404 como si no existiera
   * @throws NotFoundException (404) si no existe (o está desactivada y no puede verla)
   */
  async findOne(id: string, verInactivas = false) {
    // Una actividad desactivada consultada por un visitante responde 404
    const filter: QueryFilter<Actividad> = { _id: id, ...(!verInactivas && { isActive: true }) };
    const actividad = await this.actividadModel.findOne(filter);
    if (!actividad) throw new NotFoundException(`Actividad with id ${id} not found`);
    return actividad;
  }

  /**
   * Edita una actividad. Solo cambia los campos que vienen en el body.
   * También sirve para reactivarla con { "isActive": true }, o para quitar el botón
   * de inscripción con { "inscripcion_url": null }.
   *
   * @returns la actividad actualizada
   * @throws NotFoundException (404) si no existe
   * @throws BadRequestException (400) si las fechas quedarían al revés
   */
  async update(id: string, updateActividadDto: UpdateActividadDto, usuario?: Auth | null) {
    // Sin filtro isActive: así un ADMIN puede reactivarla con { "isActive": true }
    const actividad = await this.actividadModel.findById(id);
    if (!actividad) throw new NotFoundException(`Actividad with id ${id} not found`);

    const changes = definedOnly(updateActividadDto);
    // Un distrito vacío vuelve a "Nacional", igual que al crear
    if (changes.distrito !== undefined) changes.distrito = changes.distrito.trim() || DISTRITO_NACIONAL;

    // Se validan las fechas combinando lo guardado con lo nuevo
    // (ej. cambiar solo fecha_fin a una anterior a la fecha_inicio guardada)
    checkFechas(changes.fecha_inicio ?? actividad.fecha_inicio, changes.fecha_fin ?? actividad.fecha_fin);

    const antes = { isActive: actividad.isActive };
    actividad.set(changes);
    await actividad.save();
    await this.historial.anotar({ accion: accionAlEditar(antes, actividad), seccion: 'actividades', registro: actividad, titulo: actividad.titulo, usuario });
    return actividad;
  }

  /**
   * Desactiva una actividad (borrado lógico): deja de verse en el sitio, pero se puede
   * reactivar con PATCH { "isActive": true }.
   * @throws NotFoundException (404) si no existe o ya estaba desactivada
   */
  async remove(id: string, usuario?: Auth | null) {
    // Borrado lógico
    const actividad = await this.findOne(id);
    actividad.isActive = false;
    await actividad.save();
    await this.historial.anotar({ accion: AccionHistorial.desactivar, seccion: 'actividades', registro: actividad, titulo: actividad.titulo, usuario });
    return { message: `Actividad ${id} deactivated` };
  }
}

/**
 * Valida que la actividad no termine antes de empezar.
 * Acepta texto ISO (lo que llega en el body) o Date (lo que está guardado).
 * Sin fecha_fin no hay nada que validar.
 * @throws BadRequestException (400) si fin < inicio
 */
const checkFechas = (inicio: string | Date, fin?: string | Date | null) => {
  if (fin && new Date(fin) < new Date(inicio)) {
    throw new BadRequestException('fecha_fin must be after fecha_inicio');
  }
};

/**
 * Filtro: actividades que siguen vigentes desde esa fecha. Termina después (o, sin
 * fecha_fin, empieza después): incluye el 2º día de un retiro que empezó antes.
 */
const vigentesDesde = (fecha: Date) => ({
  $or: [{ fecha_fin: { $gte: fecha } }, { fecha_fin: null, fecha_inicio: { $gte: fecha } }],
});

/** Solo la fecha, sin hora: "2026-12-31". */
const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Inicio del día para el filtro ?desde=, en hora de Chile.
 *
 * Con solo la fecha ("2026-10-01"), new Date() da las 00:00 UTC, que en Chile todavía es
 * la noche del día ANTERIOR. Se usa UTC-3 (horario de verano), así en invierno (UTC-4) se
 * cuela como mucho la última hora del día anterior, pero nunca queda fuera algo del día pedido.
 * Si trae hora ("2026-10-01T08:00:00-03:00"), se usa tal cual.
 */
const inicioDelDia = (desde: string) => new Date(SOLO_FECHA.test(desde) ? `${desde}T00:00:00-03:00` : desde);

/**
 * Fin del día para el filtro ?hasta=, en hora de Chile.
 *
 * Con solo la fecha ("2026-12-31"), new Date() da las 00:00 UTC, que en Chile es la tarde
 * del día ANTERIOR: una actividad del 31 a las 19:00 quedaba fuera. Se usa UTC-4 (horario
 * de invierno), así en verano (UTC-3) se cuela como mucho la primera hora del día siguiente,
 * pero nunca queda fuera algo del día pedido.
 * Si trae hora ("2026-12-31T18:00:00-03:00"), se usa tal cual.
 */
const finDelDia = (hasta: string) => new Date(SOLO_FECHA.test(hasta) ? `${hasta}T23:59:59.999-04:00` : hasta);
