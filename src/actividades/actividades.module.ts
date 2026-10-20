import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ActividadesService } from './actividades.service.js';
import { ActividadesController } from './actividades.controller.js';
import { Actividad, ActividadSchema } from './entities/actividad.entity.js';

/**
 * Módulo del calendario de actividades. Registra el controller, el servicio y el modelo de Mongo.
 */
@Module({
  controllers: [ActividadesController],
  providers: [ActividadesService],
  imports: [
    // Registra el modelo Actividad. El nombre de la colección sale de config.yaml
    // (mongo.collectionNameActividad); si no está definido, usa "actividades"
    MongooseModule.forFeatureAsync([
      {
        name: Actividad.name,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => {
          const collection = String(configService.get('mongo.collectionNameActividad') ?? 'actividades');
          const schema = ActividadSchema;
          schema.set('collection', collection);
          return schema;
        }
      }
    ]),
  ]
})
export class ActividadesModule { }
