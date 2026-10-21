import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, type QueryFilter } from 'mongoose';
import { CreateNoticiaDto } from './dto/create-noticia.dto.js';
import { UpdateNoticiaDto } from './dto/update-noticia.dto.js';
import { FindNoticiasDto } from './dto/find-noticias.dto.js';
import { CAMPOS_FICHA_NOTICIA, Noticia } from './entities/noticia.entity.js';
import { faltaAlguno } from '../common/utils/pendientes.utils.js';
import { HistorialService, accionAlEditar } from '../historial/historial.service.js';
import { AccionHistorial } from '../historial/entities/historial.entity.js';
import { Auth } from '../auth/entities/auth.entity.js';
import { containsRegex, definedOnly, paginated } from '../common/utils/mongo.utils.js';

/**
 * Qué datos del autor se incluyen al devolver una noticia. populate reemplaza el id
 * guardado en "autor" por { _id, name, last_name } del usuario.
 */
// Al devolver una noticia se incluye el nombre del autor (nunca su email ni password)
const AUTOR_FIELDS = { path: 'autor', select: 'name last_name' };

/**
 * Lógica de noticias: consultas a Mongo, borradores y publicación.
 * No sabe de roles: el controller le indica si quien consulta puede ver los borradores.
 */
@Injectable()
export class NoticiasService {

  /**
   * @param noticiaModel modelo de Mongo de las noticias
   * @param historial    anota cada cambio para "Actividad reciente" del panel
   */
  constructor(
    @InjectModel(Noticia.name) private readonly noticiaModel: Model<Noticia>,
    private readonly historial: HistorialService,
  ) {}

  /**
   * Crea una noticia (borrador por defecto).
   *
   * @param createNoticiaDto datos de la noticia
   * @param autor            usuario del token; se guarda como autor (no se acepta en el body)
   * @returns la noticia creada, con el nombre del autor
   */
  async create(createNoticiaDto: CreateNoticiaDto, autor: Auth) {
    const noticia = await this.noticiaModel.create({
      ...definedOnly(createNoticiaDto),
      autor: autor._id,
      // Si se publica y no trae fecha, la fecha es ahora
      fecha_publicacion: createNoticiaDto.fecha_publicacion ?? (createNoticiaDto.publicado ? new Date() : undefined),
    });
    // Creada ya publicada cuenta como "publicó"; si no, "creó el borrador"
    const accion = noticia.publicado ? AccionHistorial.publicar : AccionHistorial.crear;
    await this.historial.anotar({ accion, seccion: 'noticias', registro: noticia, titulo: noticia.titulo, usuario: autor });
    return noticia.populate(AUTOR_FIELDS);
  }

  /**
   * Lista paginada, de la más reciente a la más antigua.
   *
   * @param query         filtros: publicado, isActive, pendientes, categoria, search (en el título), limit, offset
   * @param verBorradores true solo para roles que gestionan noticias. Si es false, siempre
   *                      devuelve solo publicadas y activas aunque se pida otra cosa en la URL.
   * @returns { total, limit, offset, data } — sin el campo contenido (solo el detalle lo trae)
   */
  async findAll({ publicado, isActive, pendientes, categoria, search, limit = 20, offset = 0 }: FindNoticiasDto, verBorradores = false) {
    // El panel puede listar las desactivadas (?isActive=false) para reactivarlas
    const filter: QueryFilter<Noticia> = { isActive: verBorradores ? (isActive ?? true) : true };
    // Quien no gestiona noticias solo ve las publicadas, pida lo que pida en ?publicado=
    if (!verBorradores) filter.publicado = true;
    else if (publicado !== undefined) filter.publicado = publicado;
    if (categoria) filter.categoria = categoria;
    if (search) filter.titulo = containsRegex(search);
    // Noticias incompletas (sin imagen), solo para el panel
    if (pendientes && verBorradores) Object.assign(filter, faltaAlguno(CAMPOS_FICHA_NOTICIA));

    // La página y el total se piden a la vez para no esperar dos viajes a Mongo
    const [data, total] = await Promise.all([
      this.noticiaModel.find(filter)
        // Primero las publicadas más recientes; los borradores al final, por fecha de creación
        .sort({ fecha_publicacion: -1, created_at: -1 })
        .skip(offset).limit(limit)
        .select('-contenido') // el listado no necesita el texto completo
        .populate(AUTOR_FIELDS),
      this.noticiaModel.countDocuments(filter),
    ]);
    return paginated(data, total, limit, offset);
  }

  /**
   * Para el Resumen del panel ("4 noticias publicadas · 1 en borrador"). Sin las desactivadas.
   * @returns { publicadas, borradores }
   */
  async contar() {
    const [publicadas, borradores] = await Promise.all([
      this.noticiaModel.countDocuments({ isActive: true, publicado: true }),
      this.noticiaModel.countDocuments({ isActive: true, publicado: false }),
    ]);
    return { publicadas, borradores };
  }

  /**
   * Borradores activos, del último editado al más antiguo. Lo usa el "Por hacer" del panel
   * ("Terminar el borrador de noticia").
   *
   * @param limit cuántos traer
   * @returns { total, data: [{ _id, titulo, update_at }] } — total cuenta todos, no solo los traídos
   */
  async borradores(limit: number) {
    const filter: QueryFilter<Noticia> = { isActive: true, publicado: false };
    const [data, total] = await Promise.all([
      this.noticiaModel.find(filter).sort({ update_at: -1 }).limit(limit).select('titulo update_at').lean(),
      this.noticiaModel.countDocuments(filter),
    ]);
    return { total, data };
  }

  /**
   * Una noticia por id, con contenido completo y nombre del autor.
   * @param verBorradores si es false (visitantes), un borrador responde 404 como si no existiera
   * @throws NotFoundException (404) si no existe, está desactivada, o es un borrador y no puede verlo
   */
  async findOne(id: string, verBorradores = false) {
    // Un borrador consultado por un visitante responde 404, como si no existiera
    const filter: QueryFilter<Noticia> = { _id: id, isActive: true, ...(!verBorradores && { publicado: true }) };
    const noticia = await this.noticiaModel.findOne(filter).populate(AUTOR_FIELDS);
    if (!noticia) throw new NotFoundException(`Noticia with id ${id} not found`);
    return noticia;
  }

  /**
   * Edita una noticia. Solo cambia los campos que vienen en el body.
   * Con { "publicado": true } publica un borrador; con { "isActive": true } la reactiva.
   *
   * @returns la noticia actualizada, con el nombre del autor
   * @throws NotFoundException (404) si no existe
   */
  async update(id: string, updateNoticiaDto: UpdateNoticiaDto, usuario?: Auth | null) {
    // Sin filtro isActive: así un ADMIN puede reactivarla con { "isActive": true }
    const noticia = await this.noticiaModel.findById(id);
    if (!noticia) throw new NotFoundException(`Noticia with id ${id} not found`);

    const antes = { isActive: noticia.isActive, publicado: noticia.publicado };
    noticia.set(definedOnly(updateNoticiaDto));
    // Primera vez que se publica: queda registrada la fecha (si se despublica, se conserva)
    if (noticia.publicado && !noticia.fecha_publicacion) noticia.fecha_publicacion = new Date();

    await noticia.save();
    await this.historial.anotar({ accion: accionAlEditar(antes, noticia), seccion: 'noticias', registro: noticia, titulo: noticia.titulo, usuario });
    return noticia.populate(AUTOR_FIELDS);
  }

  /**
   * Desactiva una noticia (borrado lógico), sea publicada o borrador.
   * Se reactiva con PATCH { "isActive": true }.
   * @throws NotFoundException (404) si no existe o ya estaba desactivada
   */
  async remove(id: string, usuario?: Auth | null) {
    // Borrado lógico (también de borradores)
    const noticia = await this.findOne(id, true);
    noticia.isActive = false;
    await noticia.save();
    await this.historial.anotar({ accion: AccionHistorial.desactivar, seccion: 'noticias', registro: noticia, titulo: noticia.titulo, usuario });
    return { message: `Noticia ${id} deactivated` };
  }
}
