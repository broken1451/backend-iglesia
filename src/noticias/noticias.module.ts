import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NoticiasService } from './noticias.service.js';
import { NoticiasController } from './noticias.controller.js';
import { Noticia, NoticiaSchema } from './entities/noticia.entity.js';

/**
 * Módulo de noticias. Registra el controller, el servicio y el modelo de Mongo.
 */
@Module({
  controllers: [NoticiasController],
  providers: [NoticiasService],
  imports: [
    // Registra el modelo Noticia. El nombre de la colección sale de config.yaml
    // (mongo.collectionNameNoticia); si no está definido, usa "noticias"
    MongooseModule.forFeatureAsync([
      {
        name: Noticia.name,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => {
          const collection = String(configService.get('mongo.collectionNameNoticia') ?? 'noticias');
          const schema = NoticiaSchema;
          schema.set('collection', collection);
          return schema;
        }
      }
    ]),
  ]
})
export class NoticiasModule { }
