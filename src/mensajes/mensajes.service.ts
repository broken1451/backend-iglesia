import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, type QueryFilter } from 'mongoose';
import { CreateMensajeDto } from './dto/create-mensaje.dto.js';
import { UpdateMensajeDto } from './dto/update-mensaje.dto.js';
import { FindMensajesDto } from './dto/find-mensajes.dto.js';
import { Mensaje } from './entities/mensaje.entity.js';
import { containsRegex, definedOnly, paginated } from '../common/utils/mongo.utils.js';

/**
 * Lógica de los mensajes del formulario de contacto: guardarlos, listarlos y marcarlos.
 */
@Injectable()
export class MensajesService {

  /** @param mensajeModel modelo de Mongo de los mensajes */
  constructor(@InjectModel(Mensaje.name) private readonly mensajeModel: Model<Mensaje>) {}

  /**
   * Guarda un mensaje del sitio (llega sin leer).
   * @returns solo una confirmación: el visitante no necesita ver el registro guardado
   */
  async create(createMensajeDto: CreateMensajeDto) {
    await this.mensajeModel.create(definedOnly(createMensajeDto));
    return { message: 'Mensaje recibido' };
  }

  /**
   * Lista paginada, del más nuevo al más viejo.
   * @param query filtros: leido, isActive, search (en nombre, correo o asunto), limit, offset
   * @returns { total, limit, offset, data }
   */
  async findAll({ leido, isActive, search, limit = 20, offset = 0 }: FindMensajesDto) {
    const filter: QueryFilter<Mensaje> = { isActive: isActive ?? true };
    if (leido !== undefined) filter.leido = leido;
    if (search) {
      const regex = containsRegex(search);
      filter.$or = [{ nombre: regex }, { email: regex }, { asunto: regex }];
    }

    // La página y el total se piden a la vez para no esperar dos viajes a Mongo
    const [data, total] = await Promise.all([
      this.mensajeModel.find(filter).sort({ created_at: -1 }).skip(offset).limit(limit),
      this.mensajeModel.countDocuments(filter),
    ]);
    return paginated(data, total, limit, offset);
  }

  /**
   * Un mensaje por id (también archivado).
   * @throws NotFoundException (404) si no existe
   */
  async findOne(id: string) {
    const mensaje = await this.mensajeModel.findById(id);
    if (!mensaje) throw new NotFoundException(`Mensaje with id ${id} not found`);
    return mensaje;
  }

  /**
   * Marca como leído / no leído, o archiva / recupera.
   * @returns el mensaje actualizado
   */
  async update(id: string, updateMensajeDto: UpdateMensajeDto) {
    const mensaje = await this.findOne(id);
    mensaje.set(definedOnly(updateMensajeDto));
    return mensaje.save();
  }

  /** Archiva un mensaje (borrado lógico). Se recupera con PATCH { "isActive": true }. */
  async remove(id: string) {
    const mensaje = await this.findOne(id);
    mensaje.isActive = false;
    await mensaje.save();
    return { message: `Mensaje ${id} archived` };
  }

  /**
   * Para el Resumen del panel ("3 sin leer, 4 en total"). No cuenta los archivados.
   * @returns { total, sinLeer }
   */
  async contar() {
    const [total, sinLeer] = await Promise.all([
      this.mensajeModel.countDocuments({ isActive: true }),
      this.mensajeModel.countDocuments({ isActive: true, leido: false }),
    ]);
    return { total, sinLeer };
  }
}
