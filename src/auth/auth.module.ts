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
import './auth.types.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtAuth, RolesPolicy],
  imports: [
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
        const key = process.env.JWT_SECRET || configService.get<string>('jwt.secret');
        if (!key || key.length < 32) {
          throw new Error('JWT_SECRET must be defined (.env or config.yaml jwt.secret) and have at least 32 characters');
        }
        return {
          accessToken: {
            key,
            issuer: 'iglesia-api',
            audience: 'iglesia-client',
            ttl: configService.get<Duration>('jwt.expiresIn') || '8h',
          },
          // Sin refresh tokens: al expirar el token el usuario vuelve a hacer login
          refreshToken: false,
        };
      },
    }),

    // Guard global: TODAS las rutas deben declarar quién puede entrar
    // (@Roles(...), @Can(...), @Can.Anyone() o @Public()); si no, responden 403
    AuthorizationModule.forRoot(),
  ],
})
export class AuthModule {}
