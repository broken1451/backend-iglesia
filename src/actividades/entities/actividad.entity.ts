import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/** Valor de distrito para las actividades que son para todos los distritos. */
export const DISTRITO_NACIONAL = 'Nacional';

/**
 * Actividad del calendario, tal como se guarda en Mongo
 * (colección mongo.collectionNameActividad de config.yaml, "actividades").
 *
 * Los campos salen del diseño de la tarjeta del sitio.
 * timestamps: Mongoose llena created_at al crear y update_at en cada guardado.
 */
@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'update_at' } })
export class Actividad extends Document {

    // "Retiro de jóvenes"
    /** Título de la tarjeta. */
    @Prop({ required: [true, "The titulo is required"], type: String, trim: true })
    titulo: string;

    // Texto corto de la tarjeta
    /** Descripción breve. */
    @Prop({ type: String, trim: true })
    descripcion?: string;

    // Día y hora de inicio. El front la usa para el cuadro "24 OCT", la hora "19:00 h"
    // y para agrupar por mes
    /** Inicio (guardado en UTC). index: se ordena y filtra por fecha. */
    @Prop({ required: [true, "The fecha_inicio is required"], type: Date, index: true })
    fecha_inicio: Date;

    // Solo en actividades de varios días: el front muestra "Hasta el 25 de octubre"
    /** Término. Nunca anterior a fecha_inicio (lo valida el servicio). */
    @Prop({ type: Date })
    fecha_fin?: Date;

    // Ciudad o "En línea"
    /** Lugar que muestra la tarjeta junto al ícono 📍. */
    @Prop({ type: String, trim: true })
    lugar?: string;

    // Etiqueta de la tarjeta: "Araucanía", "Biobío"... o "Nacional" si es para todos
    /** Distrito, o DISTRITO_NACIONAL por defecto. */
    @Prop({ type: String, trim: true, default: DISTRITO_NACIONAL, index: true })
    distrito: string;

    // Si viene, el front muestra el botón "Inscribirme" con este enlace
    /** Enlace al formulario de inscripción. */
    @Prop({ type: String, trim: true })
    inscripcion_url?: string;

    /** false = desactivada (borrado lógico): no se muestra en el sitio. */
    @Prop({ type: Boolean, default: true })
    isActive: boolean;

    /** Fecha de creación (la llena `timestamps`). */
    created_at: Date;

    /** Fecha del último cambio (la llena `timestamps`). */
    update_at: Date;
}

/** Esquema de Mongoose generado a partir de la clase (lo registra ActividadesModule). */
export const ActividadSchema = SchemaFactory.createForClass(Actividad);

// Al convertir a JSON para la respuesta, no enviar el campo interno "__v"
ActividadSchema.set('toJSON', { versionKey: false });
