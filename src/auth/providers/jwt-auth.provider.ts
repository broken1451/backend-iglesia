import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  AuthenticationRegistry,
  JwtBearerProvider,
  type JwtClaims,
} from '@nestjs/authentication';
import { isValidObjectId, Model } from 'mongoose';
import { Auth } from '../entities/auth.entity.js';

// Lee el header "Authorization: Bearer <token>", verifica el JWT y carga el usuario.
// Lo que retorna validate() queda en request.user y en @CurrentUser().
@Injectable()
export class JwtAuth extends JwtBearerProvider<Auth> {
  constructor(
    @InjectModel(Auth.name) private readonly userModel: Model<Auth>,
    registry: AuthenticationRegistry,
  ) {
    super({ realm: 'iglesia' });
    registry.registerProvider(this);
  }

  async validate({ sub }: JwtClaims): Promise<Auth | null> {
    if (!sub || !isValidObjectId(sub)) return null;
    // Un usuario desactivado invalida sus tokens al instante
    return this.userModel.findOne({ _id: sub, isActive: true });
  }
}
