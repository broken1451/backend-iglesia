import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Auth } from '../../auth/entities/auth.entity.js';

/** Qué se hizo. */
export enum AccionHistorial {
  crear = 'crear',
  editar = 'editar',
  publicar = 'publicar',
  desactivar = 'desactivar',
  reactivar = 'reactivar',
}

/** Secciones que anotan sus cambios. */
export const SECCIONES_HISTORIAL = ['iglesias', 'actividades', 'noticias'] as const;
export type SeccionHistorial = (typeof SECCIONES_HISTORIAL)[number];

/**
 * Una línea del historial de cambios: "Ana Rojas actualizó la ficha de Luz de Esperanza".
 * Lo usa "Actividad reciente" en el Resumen del panel
 * (colección mongo.collectionNameHistorial de config.yaml, "historial").
 *
 * Se guarda una línea por cada cambio (no solo el último estado), con el título que tenía
 * el registro en ese momento: si después lo renombran, la línea vieja sigue diciendo lo que pasó.
 */
@Schema({ timestamps: { createdAt: 'created_at', updatedAt: false } })
export class Historial extends Document {

    @Prop({ required: true, type: String, enum: Object.values(AccionHistorial) })
    accion: AccionHistorial;

    @Prop({ required: true, type: String, enum: SECCIONES_HISTORIAL })
    seccion: SeccionHistorial;

    /** Id del registro que cambió. */
    @Prop({ required: true, type: Types.ObjectId })
    registro: Types.ObjectId;

    /** Nombre o título del registro en ese momento. */
    @Prop({ required: true, type: String })
    titulo: string;

    /** Quién lo hizo. Vacío si fue sin sesión (hoy, POST /iglesias está abierto). */
    @Prop({ type: Types.ObjectId, ref: Auth.name })
    usuario?: Types.ObjectId;

    /** Cuándo (la llena `timestamps`). */
    created_at: Date;
}

/** Esquema de Mongoose generado a partir de la clase (lo registra HistorialModule). */
export const HistorialSchema = SchemaFactory.createForClass(Historial);

// "Actividad reciente" pide siempre los últimos, filtrando por sección
HistorialSchema.index({ seccion: 1, created_at: -1 });

HistorialSchema.set('toJSON', { versionKey: false });
