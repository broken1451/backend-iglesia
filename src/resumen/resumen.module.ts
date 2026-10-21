import { Module } from '@nestjs/common';
import { ResumenController } from './resumen.controller.js';
import { ResumenService } from './resumen.service.js';
import { IglesiasModule } from '../iglesias/iglesias.module.js';
import { ActividadesModule } from '../actividades/actividades.module.js';
import { NoticiasModule } from '../noticias/noticias.module.js';
import { MensajesModule } from '../mensajes/mensajes.module.js';
import { HistorialModule } from '../historial/historial.module.js';

/**
 * Módulo de la pantalla "Resumen" del panel: tarjetas, "Por hacer", accesos rápidos,
 * actividad reciente y avance por distrito.
 * No tiene modelo propio: consulta a los servicios de cada sección (que los exportan).
 */
@Module({
  imports: [IglesiasModule, ActividadesModule, NoticiasModule, MensajesModule, HistorialModule],
  controllers: [ResumenController],
  providers: [ResumenService],
})
export class ResumenModule {}
