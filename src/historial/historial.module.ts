import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HistorialService } from './historial.service.js';
import { Historial, HistorialSchema } from './entities/historial.entity.js';

/**
 * Historial de cambios ("Actividad reciente" del panel). No tiene rutas propias: lo usan
 * los servicios de iglesias, actividades y noticias (anotar) y el Resumen (recientes).
 */
@Module({
  providers: [HistorialService],
  exports: [HistorialService],
  imports: [
    // El nombre de la colección sale de config.yaml (mongo.collectionNameHistorial); si no, "historial"
    MongooseModule.forFeatureAsync([
      {
        name: Historial.name,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => {
          const collection = String(configService.get('mongo.collectionNameHistorial') ?? 'historial');
          const schema = HistorialSchema;
          schema.set('collection', collection);
          return schema;
        }
      }
    ]),
  ]
})
export class HistorialModule { }
