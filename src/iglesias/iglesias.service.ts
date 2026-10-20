import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, type QueryFilter } from 'mongoose';
import { CreateIglesiaDto } from './dto/create-iglesia.dto.js';
import { UpdateIglesiaDto } from './dto/update-iglesia.dto.js';
import { FindIglesiasDto } from './dto/find-iglesias.dto.js';
import { Iglesia } from './entities/iglesia.entity.js';
import { containsRegex, definedOnly, equalsRegex, paginated, rethrowDuplicate } from '../common/utils/mongo.utils.js';

/** Mensaje del 400 cuando se repite nombre + distrito (índice único de la entidad). */
const DUPLICATE = 'An iglesia with that name already exists in that distrito';

/**
 * Lógica del directorio de iglesias: consultas a Mongo y reglas de negocio.
 * No sabe de roles: el controller le indica si quien consulta puede ver las desactivadas.
 */
@Injectable()
export class IglesiasService {

  /** @param iglesiaModel modelo de Mongo de las iglesias */
  constructor(@InjectModel(Iglesia.name) private readonly iglesiaModel: Model<Iglesia>) {}

  /**
   * Crea una iglesia.
   * @returns la iglesia creada
   * @throws BadRequestException (400) si viene lat sin lng (o al revés),
   *         o si ya existe una iglesia con ese nombre en ese distrito
   */
  async create(createIglesiaDto: CreateIglesiaDto) {
    checkCoordenadas(createIglesiaDto.lat, createIglesiaDto.lng);
    try {
      return await this.iglesiaModel.create(createIglesiaDto);
    } catch (error) {
      rethrowDuplicate(error, DUPLICATE);
    }
  }

  /**
   * Lista paginada de iglesias, ordenada por distrito y luego por nombre.
   *
   * @param query        filtros: distrito (exacto), search (en el nombre), isActive, limit, offset.
   *                     distrito y search no distinguen mayúsculas ni tildes.
   * @param verInactivas true solo para roles que gestionan iglesias. Si es false, siempre
   *                     devuelve solo activas aunque se pida ?isActive=false; así un visitante
   *                     no puede ver lo desactivado manipulando la URL.
   * @returns { total, limit, offset, data }
   */
  async findAll({ distrito, search, isActive, limit = 20, offset = 0 }: FindIglesiasDto, verInactivas = false) {
    // Quien no gestiona iglesias solo ve las activas, pida lo que pida en ?isActive=
    const filter: QueryFilter<Iglesia> = { isActive: verInactivas ? (isActive ?? true) : true };
    if (distrito) filter.distrito = equalsRegex(distrito);
    if (search) filter.name = containsRegex(search);

    // La página y el total se piden a la vez para no esperar dos viajes a Mongo
    const [data, total] = await Promise.all([
      this.iglesiaModel.find(filter).sort({ distrito: 1, name: 1 }).skip(offset).limit(limit),
      this.iglesiaModel.countDocuments(filter),
    ]);
    return paginated(data, total, limit, offset);
  }

  /**
   * Distritos que tienen al menos una iglesia activa, con cuántas tiene cada uno.
   * Lo usa el filtro de distritos del sitio, sin tener que descargar todas las iglesias.
   *
   * @returns [{ distrito: "Araucanía", total: 12 }, ...] en orden alfabético español
   */
  distritos() {
    return this.iglesiaModel.aggregate<{ distrito: string; total: number }>([
      { $match: { isActive: true } },                               // solo activas
      { $group: { _id: '$distrito', total: { $sum: 1 } } },          // una fila por distrito, contando
      { $project: { _id: 0, distrito: '$_id', total: 1 } },          // renombra _id → distrito
    ])
      // Orden alfabético en español: "Ñuble" va después de "Norte", no al final
      .sort({ distrito: 1 })
      .collation({ locale: 'es' });
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
  async update(id: string, updateIglesiaDto: UpdateIglesiaDto) {
    // Sin filtro isActive: así un ADMIN puede reactivar una iglesia con { "isActive": true }
    const iglesia = await this.iglesiaModel.findById(id);
    if (!iglesia) throw new NotFoundException(`Iglesia with id ${id} not found`);

    const changes = definedOnly(updateIglesiaDto);
    // Se validan las coordenadas combinando lo guardado con lo nuevo (null borra la ubicación)
    checkCoordenadas(
      'lat' in changes ? changes.lat : iglesia.lat,
      'lng' in changes ? changes.lng : iglesia.lng,
    );

    iglesia.set(changes);
    try {
      return await iglesia.save();
    } catch (error) {
      rethrowDuplicate(error, DUPLICATE);
    }
  }

  /**
   * Desactiva una iglesia (borrado lógico): deja de verse en el sitio, pero no se pierde
   * y se puede reactivar con PATCH { "isActive": true }.
   * @throws NotFoundException (404) si no existe o ya estaba desactivada
   */
  async remove(id: string) {
    // Borrado lógico: deja de aparecer en el sitio pero se puede reactivar
    const iglesia = await this.findOne(id);
    iglesia.isActive = false;
    await iglesia.save();
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
