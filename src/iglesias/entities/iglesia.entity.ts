import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { camposFaltantes } from '../../common/utils/pendientes.utils.js';

/**
 * Los 5 datos de una ficha completa: dirección, horario, pastor, correo y teléfono.
 * Si falta alguno, la iglesia aparece en el "Por hacer" del panel, cuenta como incompleta
 * en "Fichas completas" y en el avance por distrito, y lo indica su campo `pendientes`.
 */
export const CAMPOS_FICHA_IGLESIA = ['direccion', 'reuniones', 'encargado', 'email', 'telefono'] as const;

/**
 * Iglesia del directorio, tal como se guarda en Mongo
 * (colección mongo.collectionNameIglesia de config.yaml, "iglesias").
 *
 * timestamps: Mongoose llena created_at al crear y update_at en cada guardado.
 * trim: Mongoose quita los espacios de los extremos al guardar.
 * id: false: sin el virtual "id" (repetiría _id ahora que el JSON incluye los virtuales).
 */
@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'update_at' }, id: false })
export class Iglesia extends Document {

    /** Distrito al que pertenece (ej. "Araucanía"). index: se filtra mucho por este campo. */
    @Prop({ required: [true, "The distrito is required"], type: String, trim: true, index: true })
    distrito: string;

    /** Nombre de la iglesia. Único dentro de su distrito (ver índice abajo). */
    @Prop({ required: [true, "The name is required"], type: String, trim: true })
    name: string;

    /** Dirección postal. */
    @Prop({ type: String, trim: true })
    direccion?: string;

    /** Horarios de reunión, texto libre. Ej: "Domingo 11:00, Miércoles 19:30" */
    @Prop({ type: String, trim: true })
    reuniones?: string;

    /** Pastor o persona encargada. */
    @Prop({ type: String, trim: true })
    encargado?: string;

    /** Correo de contacto, guardado en minúsculas. */
    @Prop({ type: String, trim: true, lowercase: true })
    email?: string;

    /** Teléfono o WhatsApp de contacto, texto libre. Ej: "+56 9 1234 5678" */
    @Prop({ type: String, trim: true })
    telefono?: string;

    /** Latitud para el mapa (-90 a 90). Siempre junto con lng. */
    @Prop({ type: Number, min: -90, max: 90 })
    lat?: number;

    /** Longitud para el mapa (-180 a 180). Siempre junto con lat. */
    @Prop({ type: Number, min: -180, max: 180 })
    lng?: number;

    /** false = desactivada (borrado lógico): no se muestra en el sitio. */
    @Prop({ type: Boolean, default: true })
    isActive: boolean;

    /** Fecha de creación (la llena `timestamps`). */
    created_at: Date;

    /** Fecha del último cambio (la llena `timestamps`). */
    update_at: Date;

    /**
     * Campo calculado (no se guarda): los datos de CAMPOS_FICHA_IGLESIA que faltan.
     * [] = ficha completa. Ej: ["reuniones", "email"].
     */
    pendientes: string[];
}

/** Esquema de Mongoose generado a partir de la clase (lo registra IglesiasModule). */
export const IglesiaSchema = SchemaFactory.createForClass(Iglesia);

// No puede haber dos iglesias con el mismo nombre en el mismo distrito
// (collation strength 2 = "Central" y "central" cuentan como el mismo nombre).
// Ojo: sí distingue tildes, "Concepción" y "Concepcion" se consideran distintos
IglesiaSchema.index(
    { distrito: 1, name: 1 },
    { unique: true, collation: { locale: 'es', strength: 2 } },
);

// Calcula "pendientes" a partir de lo guardado, cada vez que se lee (no ocupa espacio en Mongo)
IglesiaSchema.virtual('pendientes').get(function (this: Iglesia) {
    return camposFaltantes(this, CAMPOS_FICHA_IGLESIA);
});

// Al convertir a JSON para la respuesta: sin el campo interno "__v" y con los virtuales (pendientes)
IglesiaSchema.set('toJSON', { versionKey: false, virtuals: true });
