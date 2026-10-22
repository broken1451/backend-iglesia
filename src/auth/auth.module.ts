import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthenticationModule, type Duration } from '@nestjs/authentication';
import { AuthorizationModule } from '@nestjs/authorization';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { Auth, AuthShema } from './entities/auth.entity.js';
import { JwtAuth } from './providers/jwt-auth.provider.js';
import { RolesPolicy } from './policies/roles.policy.js';
import { IglesiasModule } from '../iglesias/iglesias.module.js';
import './auth.types.js';

/**
 * Módulo de seguridad. Además de los endpoints de usuarios (/api/auth), activa
 * los dos guards globales que protegen TODA la API:
 * 1. Autenticación: ¿quién eres? (token)
 * 2. Autorización: ¿qué puedes hacer? (roles)
 */
@Module({
  controllers: [AuthController],
  // JwtAuth: convierte el token en usuario. RolesPolicy: la regla que usa @Roles(...)
  providers: [AuthService, JwtAuth, RolesPolicy],
  imports: [
    // Para validar la iglesia asociada a un usuario con rol IGLESIA (IglesiasService)
    IglesiasModule,

    // Modelo de usuarios; el nombre de la colección sale de config.yaml (mongo.collectionName)
    MongooseModule.forFeatureAsync([
      {
        name: Auth.name,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => {
          const collection = String(configService.get('mongo.collectionName'));
          const schema = AuthShema;
          schema.set('collection', collection);
          return schema;
        }
      }
    ]),

    // Guard global: TODAS las rutas exigen "Authorization: Bearer <token>" salvo las @Public()
    AuthenticationModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        // La clave que firma los tokens. Sin ella, o si es corta, la app no arranca:
        // un secreto débil permitiría falsificar tokens
        const key = process.env.JWT_SECRET || configService.get<string>('jwt.secret');
        if (!key || key.length < 32) {
          throw new Error('JWT_SECRET must be defined (.env or config.yaml jwt.secret) and have at least 32 characters');
        }
        return {
          accessToken: {
            key,
            // Quién emite el token y para quién es. Un token con otros valores se rechaza
            issuer: 'iglesia-api',
            audience: 'iglesia-client',
            // Duración del token: jwt.expiresIn de config.yaml, o 8 horas (una jornada en el panel)
            ttl: configService.get<Duration>('jwt.expiresIn') || '8h',
          },
          // Sin refresh tokens: al expirar el token el usuario vuelve a hacer login.
          // Así no hace falta guardar refresh tokens en una base de datos
          refreshToken: false,
        };
      },
    }),

    // Guard global: TODAS las rutas deben declarar quién puede entrar
    // (@Roles(...), @Can(...), @Can.Anyone() o @Public()); si no, responden 403.
    // Así una ruta nueva nunca queda abierta por olvido
    AuthorizationModule.forRoot(),
  ],
})
export class AuthModule {}
