import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, type QueryFilter } from 'mongoose';
import { CreateNoticiaDto } from './dto/create-noticia.dto.js';
import { UpdateNoticiaDto } from './dto/update-noticia.dto.js';
import { FindNoticiasDto } from './dto/find-noticias.dto.js';
import { Noticia } from './entities/noticia.entity.js';
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

  /** @param noticiaModel modelo de Mongo de las noticias */
  constructor(@InjectModel(Noticia.name) private readonly noticiaModel: Model<Noticia>) {}

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
    return noticia.populate(AUTOR_FIELDS);
  }

  /**
   * Lista paginada, de la más reciente a la más antigua.
   *
   * @param query         filtros: publicado, isActive, categoria, search (en el título), limit, offset
   * @param verBorradores true solo para roles que gestionan noticias. Si es false, siempre
   *                      devuelve solo publicadas y activas aunque se pida otra cosa en la URL.
   * @returns { total, limit, offset, data } — sin el campo contenido (solo el detalle lo trae)
   */
  async findAll({ publicado, isActive, categoria, search, limit = 20, offset = 0 }: FindNoticiasDto, verBorradores = false) {
    // El panel puede listar las desactivadas (?isActive=false) para reactivarlas
    const filter: QueryFilter<Noticia> = { isActive: verBorradores ? (isActive ?? true) : true };
    // Quien no gestiona noticias solo ve las publicadas, pida lo que pida en ?publicado=
    if (!verBorradores) filter.publicado = true;
    else if (publicado !== undefined) filter.publicado = publicado;
    if (categoria) filter.categoria = categoria;
    if (search) filter.titulo = containsRegex(search);

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
  async update(id: string, updateNoticiaDto: UpdateNoticiaDto) {
    // Sin filtro isActive: así un ADMIN puede reactivarla con { "isActive": true }
    const noticia = await this.noticiaModel.findById(id);
    if (!noticia) throw new NotFoundException(`Noticia with id ${id} not found`);

    noticia.set(definedOnly(updateNoticiaDto));
    // Primera vez que se publica: queda registrada la fecha (si se despublica, se conserva)
    if (noticia.publicado && !noticia.fecha_publicacion) noticia.fecha_publicacion = new Date();

    await noticia.save();
    return noticia.populate(AUTOR_FIELDS);
  }

  /**
   * Desactiva una noticia (borrado lógico), sea publicada o borrador.
   * Se reactiva con PATCH { "isActive": true }.
   * @throws NotFoundException (404) si no existe o ya estaba desactivada
   */
  async remove(id: string) {
    // Borrado lógico (también de borradores)
    const noticia = await this.findOne(id, true);
    noticia.isActive = false;
    await noticia.save();
    return { message: `Noticia ${id} deactivated` };
  }
}
