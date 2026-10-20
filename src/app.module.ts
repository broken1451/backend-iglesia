import { Module } from '@nestjs/common';
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
    // Ojo: con cualquier otro valor de STAGE, la URI queda vacía y la app no conecta
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        if (!configService.get('mongo.url') && !process.env.URI) {
          throw new Error('MongoDB URI is not defined in the environment variables or config file');
        }

        let uri = '';
        let dbName = '';
        if (process.env.STAGE === 'dev') {
          uri = String(configService.get('mongo.url'))
          dbName = String(configService.get('mongo.dbName'))
        } else if (process.env.STAGE === 'production') {
          uri = String(process.env.URI)
          dbName = String(process.env.DBNAME)
        }
        // Ojo: en producción la URI puede incluir usuario y clave, y esto la imprime en los logs
        console.log('MongoDB URI:', uri);
        console.log('MongoDB Database Name:', dbName);
        return {
          uri,
          dbName
        }
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
