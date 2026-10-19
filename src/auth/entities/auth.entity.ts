import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ValidRoles } from '../interfaces/role.enum.js';

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'update_at' } })
export class Auth extends Document {

    @Prop({ required: [true, "The name is required"], type: String })
    name: string;

    @Prop({ required: [true, "The last_name is required"], type: String })
    last_name: string;

    @Prop({ required: [true, "The email is required"], type: String, unique: true })
    email: string;

    // select: false -> nunca se devuelve en las consultas salvo que se pida con .select('+password')
    @Prop({ required: [true, "The password is required"], type: String, select: false })
    password: string;

    // Rol mínimo por defecto. Antes era ADMIN: cualquiera que se registraba quedaba como administrador.
    @Prop({ type: [String], enum: Object.values(ValidRoles), default: [ValidRoles.admin] })
    roles: ValidRoles[];

    @Prop({ type: Date, default: Date.now })
    created_at: Date;

    @Prop({ type: Date, default: Date.now })
    update_at: Date;

    @Prop({ type: Date, default: Date.now })
    update_at_login: Date;

    @Prop({ type: Boolean, default: true })
    isActive: boolean;

    @Prop({ type: Number, default: 0 })
    retry: number;
}

export const AuthShema = SchemaFactory.createForClass(Auth);

// Por si en algún momento se carga con .select('+password'), no se filtra en la respuesta
AuthShema.set('toJSON', {
    versionKey: false,
    transform: (_doc, ret) => {
        delete (ret as Partial<Auth>).password;
        return ret;
    },
});
