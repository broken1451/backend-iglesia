import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ValidRoles } from '../interfaces/role.enum.js';
import { Iglesia } from '../../iglesias/entities/iglesia.entity.js';

/**
 * Usuario del panel, tal como se guarda en Mongo (colección mongo.collectionName
 * de config.yaml, "users").
 *
 * timestamps: Mongoose llena created_at al crear y update_at en cada guardado.
 */
@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'update_at' } })
export class Auth extends Document {

    /** Nombre, en minúsculas. */
    @Prop({ required: [true, "The name is required"], type: String })
    name: string;

    /** Apellido, en minúsculas. */
    @Prop({ required: [true, "The last_name is required"], type: String })
    last_name: string;

    /** Correo en minúsculas. unique crea un índice: Mongo rechaza dos usuarios con el mismo. */
    @Prop({ required: [true, "The email is required"], type: String, unique: true })
    email: string;

    /**
     * Hash scrypt de la contraseña (nunca la contraseña real).
     * select: false → no se devuelve en ninguna consulta salvo que se pida con
     * .select('+password'), cosa que solo hace el login.
     */
    @Prop({ required: [true, "The password is required"], type: String, select: false })
    password: string;

    /**
     * Roles del usuario. Rol mínimo por defecto: IGLESIA.
     * Antes era ADMIN: cualquiera que se registraba quedaba como administrador.
     * enum: Mongo también rechaza un rol que no exista en ValidRoles.
     */
    @Prop({ type: [String], enum: Object.values(ValidRoles), default: [ValidRoles.iglesia] })
    roles: ValidRoles[];

    /** Fecha de creación (la mantiene `timestamps`). */
    @Prop({ type: Date, default: Date.now })
    created_at: Date;

    /** Fecha del último cambio (la mantiene `timestamps`). */
    @Prop({ type: Date, default: Date.now })
    update_at: Date;

    /** Fecha del último login correcto. */
    @Prop({ type: Date, default: Date.now })
    update_at_login: Date;

    /**
     * La iglesia del usuario. **Obligatoria si tiene el rol IGLESIA**: sin ella no puede hacer
     * login (AuthService lo exige al registrarse, al editarlo y al iniciar sesión).
     * Para los demás roles es opcional. ref permite traer sus datos con populate.
     */
    @Prop({ type: Types.ObjectId, ref: Iglesia.name, default: null })
    iglesia: Types.ObjectId | null;

    /** false = desactivado: no puede hacer login y sus tokens dejan de servir. */
    @Prop({ type: Boolean, default: true })
    isActive: boolean;

    /**
     * Intentos de login fallidos seguidos. Con 3 (MAX_INTENTOS) el usuario queda bloqueado;
     * un login correcto lo vuelve a 0, y un ADMIN lo desbloquea con PATCH { "unblock": true }.
     */
    @Prop({ type: Number, default: 0 })
    retry: number;
}

/** Esquema de Mongoose generado a partir de la clase (lo registra AuthModule). */
export const AuthShema = SchemaFactory.createForClass(Auth);

/**
 * Cómo se convierte un usuario a JSON al enviarlo en una respuesta:
 * - versionKey: false → no envía el campo interno "__v".
 * - transform → borra password por si se cargó con .select('+password') (pasa en el login).
 */
AuthShema.set('toJSON', {
    versionKey: false,
    transform: (_doc, ret) => {
        delete (ret as Partial<Auth>).password;
        return ret;
    },
});
