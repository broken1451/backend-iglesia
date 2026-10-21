import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MensajesService } from './mensajes.service.js';
import { MensajesController } from './mensajes.controller.js';
import { Mensaje, MensajeSchema } from './entities/mensaje.entity.js';

/**
 * Módulo de mensajes del formulario de contacto. Registra el controller, el servicio y el modelo.
 */
@Module({
  controllers: [MensajesController],
  providers: [MensajesService],
  // Exportado para el Resumen del panel (ResumenModule)
  exports: [MensajesService],
  imports: [
    // Registra el modelo Mensaje. El nombre de la colección sale de config.yaml
    // (mongo.collectionNameMensaje); si no está definido, usa "mensajes"
    MongooseModule.forFeatureAsync([
      {
        name: Mensaje.name,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => {
          const collection = String(configService.get('mongo.collectionNameMensaje') ?? 'mensajes');
          const schema = MensajeSchema;
          schema.set('collection', collection);
          return schema;
        }
      }
    ]),
  ]
})
export class MensajesModule { }
