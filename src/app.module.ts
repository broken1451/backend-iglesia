import { Logger, Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { ConfigModule, ConfigService } from '@nestjs/config';
import conf from './conf/config.js';
import { MongooseModule } from '@nestjs/mongoose';
import { IglesiasModule } from './iglesias/iglesias.module.js';
import { ActividadesModule } from './actividades/actividades.module.js';
import { NoticiasModule } from './noticias/noticias.module.js';
import { CorreoModule } from './correo/correo.module.js';

/**
 * Módulo raíz: junta la configuración, la conexión a MongoDB, la seguridad (AuthModule)
 * y los módulos de negocio. Todo lo que la app hace se registra aquí.
 */
@Module({
  imports: [
    // Usuarios, login y los guards globales de autenticación y autorización
    AuthModule,

    // Carga src/conf/config.yaml (y el archivo .env). isGlobal: cualquier módulo puede
    // inyectar ConfigService sin tener que importar ConfigModule
    ConfigModule.forRoot({
      load: [conf],
      isGlobal: true
    }),

    // Conexión a MongoDB. Según la variable STAGE del .env:
    // - "dev": usa mongo.url y mongo.dbName de config.yaml (el Mongo local de docker-compose)
    // - "production": usa las variables de entorno URI y DBNAME
    // Con cualquier otro valor (o sin datos de conexión) la app no arranca y dice por qué
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const stage = process.env.STAGE;
        const { uri, dbName } =
          stage === 'production'
            ? { uri: process.env.URI, dbName: process.env.DBNAME }
            : stage === 'dev'
              ? { uri: configService.get<string>('mongo.url'), dbName: configService.get<string>('mongo.dbName') }
              : {};

        if (!uri) {
          throw new Error(
            stage === 'dev' || stage === 'production'
              ? `Falta la URI de MongoDB (${stage === 'dev' ? 'mongo.url en config.yaml' : 'URI en .env'})`
              : `STAGE debe ser "dev" o "production" en .env (vale "${stage ?? ''}")`,
          );
        }

        // Se muestra la URI sin la clave: en producción incluye usuario y contraseña
        new Logger('MongoDB').log(`Conectando a ${uri.replace(/\/\/([^:/@]+):[^@]*@/, '//$1:****@')} (base "${dbName}")`);
        return { uri, dbName };
      },
    }),

    // Módulos de negocio
    IglesiasModule,     // /api/iglesias
    ActividadesModule,  // /api/actividades
    NoticiasModule,     // /api/noticias

    // Envío de correos (@nestjs/mail). Global: cualquier servicio puede inyectar Mailer
    CorreoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
