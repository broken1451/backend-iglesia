import { Module } from '@nestjs/common';
import { IglesiasService } from './iglesias.service.js';
import { IglesiasController } from './iglesias.controller.js';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Iglesia, IglesiaSchema } from './entities/iglesia.entity.js';

/**
 * Módulo del directorio de iglesias. Registra el controller, el servicio y el modelo de Mongo.
 */
@Module({
  controllers: [IglesiasController],
  providers: [IglesiasService],
  imports: [
    // Registra el modelo Iglesia. Se hace "Async" para leer el nombre de la colección
    // desde config.yaml (mongo.collectionNameIglesia) en vez de dejarlo fijo en el código
    MongooseModule.forFeatureAsync([
      {
        name: Iglesia.name,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => {
          const collection = String(configService.get('mongo.collectionNameIglesia'));
          const schema = IglesiaSchema;
          schema.set('collection', collection);
          return schema;
        }
      }
    ]),
  ]
})
export class IglesiasModule { }
