import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  AuthenticationRegistry,
  JwtBearerProvider,
  type JwtClaims,
} from '@nestjs/authentication';
import { isValidObjectId, Model } from 'mongoose';
import { Auth } from '../entities/auth.entity.js';

/**
 * Proveedor de autenticación por token: convierte el header
 * "Authorization: Bearer <token>" en el usuario de la base de datos.
 *
 * La clase base (JwtBearerProvider) hace el trabajo pesado en cada request:
 * lee el header, verifica la firma con JWT_SECRET, que no esté vencido y que
 * el emisor/audiencia sean los de auth.module.ts. Si algo falla responde 401
 * sin llegar a validate(). Si todo está bien, llama a validate() con el contenido.
 *
 * Lo que retorna validate() queda en request.user y en @CurrentUser().
 */
@Injectable()
export class JwtAuth extends JwtBearerProvider<Auth> {
  /**
   * @param userModel modelo de usuarios, para buscar al dueño del token
   * @param registry  registro de proveedores: sin registrarse aquí, el guard global no sabría que existe
   */
  constructor(
    @InjectModel(Auth.name) private readonly userModel: Model<Auth>,
    registry: AuthenticationRegistry,
  ) {
    // realm: nombre que aparece en el header WWW-Authenticate de las respuestas 401
    super({ realm: 'iglesia' });
    registry.registerProvider(this);
  }

  /**
   * Recibe el contenido del token ya verificado y devuelve el usuario.
   *
   * `sub` es el id del usuario, puesto al hacer login (AuthService.getJWT).
   * Se busca en la BD en cada request en vez de confiar en datos del token, para que:
   * - un cambio de roles aplique en el siguiente request;
   * - un usuario desactivado pierda el acceso al instante.
   *
   * @returns el usuario, o null si no existe o está desactivado (→ 401 "unknown subject")
   */
  async validate({ sub }: JwtClaims): Promise<Auth | null> {
    if (!sub || !isValidObjectId(sub)) return null;
    // Un usuario desactivado invalida sus tokens al instante
    return this.userModel.findOne({ _id: sub, isActive: true });
  }
}
