import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Auth } from '../../auth/entities/auth.entity.js';
import { NoticiaCategoria } from '../interfaces/categoria.enum.js';
import { camposFaltantes } from '../../common/utils/pendientes.utils.js';

/**
 * Datos opcionales que debería tener una noticia completa (los obligatorios ya los exige el
 * esquema). Sin imagen, la tarjeta del sitio muestra solo el ícono de la categoría.
 */
export const CAMPOS_FICHA_NOTICIA = ['imagen'] as const;

/**
 * Noticia o comunicado, tal como se guarda en Mongo
 * (colección mongo.collectionNameNoticia de config.yaml, "noticias").
 *
 * Los campos salen del diseño de la tarjeta del sitio.
 * timestamps: Mongoose llena created_at al crear y update_at en cada guardado.
 * id: false: sin el virtual "id" (repetiría _id ahora que el JSON incluye los virtuales).
 */
@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'update_at' }, id: false })
export class Noticia extends Document {

    /** Título de la tarjeta. */
    @Prop({ required: [true, "The titulo is required"], type: String, trim: true })
    titulo: string;

    // Texto corto de la tarjeta
    /** Resumen que muestra la tarjeta del listado. */
    @Prop({ required: [true, "The resumen is required"], type: String, trim: true })
    resumen: string;

    // Etiqueta de la tarjeta: "Misiones", "Comunicado oficial"...
    /** Categoría. enum: Mongo también rechaza una que no esté en NoticiaCategoria. */
    @Prop({ required: [true, "The categoria is required"], type: String, enum: Object.values(NoticiaCategoria), index: true })
    categoria: NoticiaCategoria;

    /** Texto completo. Solo se envía en el detalle (GET /:id), no en el listado. */
    @Prop({ required: [true, "The contenido is required"], type: String })
    contenido: string;

    // URL de la imagen. Si no hay, el front muestra el placeholder con el ícono de la categoría
    /** Imagen principal. */
    @Prop({ type: String, trim: true })
    imagen?: string;

    // false = borrador. Al publicarla por primera vez se guarda fecha_publicacion
    /** Si se ve en el sitio. index: el sitio siempre filtra por este campo. */
    @Prop({ type: Boolean, default: false, index: true })
    publicado: boolean;

    // La fecha que muestra la tarjeta ("16 de marzo de 2026")
    /** Fecha de publicación. index: el listado se ordena por ella. */
    @Prop({ type: Date, index: true })
    fecha_publicacion?: Date;

    // Usuario que la creó (se toma del token, no del body)
    /** Id del usuario autor. ref permite reemplazarlo por sus datos con populate. */
    @Prop({ type: Types.ObjectId, ref: Auth.name, required: true })
    autor: Types.ObjectId;

    /** false = desactivada (borrado lógico): no se muestra en ningún lado. */
    @Prop({ type: Boolean, default: true })
    isActive: boolean;

    /** Fecha de creación (la llena `timestamps`). */
    created_at: Date;

    /** Fecha del último cambio (la llena `timestamps`). */
    update_at: Date;

    /** Campo calculado (no se guarda): los datos de CAMPOS_FICHA_NOTICIA que faltan. [] = completa. */
    pendientes: string[];
}

/** Esquema de Mongoose generado a partir de la clase (lo registra NoticiasModule). */
export const NoticiaSchema = SchemaFactory.createForClass(Noticia);

// Calcula "pendientes" a partir de lo guardado, cada vez que se lee (no ocupa espacio en Mongo)
NoticiaSchema.virtual('pendientes').get(function (this: Noticia) {
    return camposFaltantes(this, CAMPOS_FICHA_NOTICIA);
});

// Al convertir a JSON para la respuesta: sin el campo interno "__v" y con los virtuales (pendientes)
NoticiaSchema.set('toJSON', { versionKey: false, virtuals: true });
