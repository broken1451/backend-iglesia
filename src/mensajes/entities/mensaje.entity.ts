import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Mensaje que un visitante envía desde el formulario de contacto del sitio
 * (colección mongo.collectionNameMensaje de config.yaml, "mensajes").
 *
 * timestamps: created_at es la fecha en que llegó.
 */
@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'update_at' } })
export class Mensaje extends Document {

    /** Nombre de quien escribe. */
    @Prop({ required: [true, "The nombre is required"], type: String, trim: true })
    nombre: string;

    /** Correo para responderle, en minúsculas. */
    @Prop({ required: [true, "The email is required"], type: String, trim: true, lowercase: true })
    email: string;

    /** Teléfono, si lo dejó. */
    @Prop({ type: String, trim: true })
    telefono?: string;

    /** Asunto, si lo escribió. */
    @Prop({ type: String, trim: true })
    asunto?: string;

    /** El mensaje. */
    @Prop({ required: [true, "The mensaje is required"], type: String, trim: true })
    mensaje: string;

    /** false = sin leer: cuenta en "Mensajes sin leer" y en el "Por hacer" del panel. */
    @Prop({ type: Boolean, default: false, index: true })
    leido: boolean;

    /** false = archivado (borrado lógico). */
    @Prop({ type: Boolean, default: true })
    isActive: boolean;

    /** Fecha en que llegó (la llena `timestamps`). */
    created_at: Date;

    /** Fecha del último cambio (la llena `timestamps`). */
    update_at: Date;
}

/** Esquema de Mongoose generado a partir de la clase (lo registra MensajesModule). */
export const MensajeSchema = SchemaFactory.createForClass(Mensaje);

// El panel los lista del más nuevo al más viejo
MensajeSchema.index({ created_at: -1 });

// Al convertir a JSON para la respuesta, no enviar el campo interno "__v"
MensajeSchema.set('toJSON', { versionKey: false });
