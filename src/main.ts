import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';


/**
 * Punto de entrada de la aplicación: crea la app de Nest, aplica la
 * configuración global (prefijo, CORS, validación) y la pone a escuchar.
 */
async function bootstrap() {
  // Crea la app a partir del módulo raíz. Se omiten los logs "debug" y "verbose"
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const logger = new Logger('bootstrap');

  // Permite que el sitio web y el panel (que viven en otro dominio/puerto) llamen a la API.
  // origin: true acepta CUALQUIER origen: antes de producción limitarlo a los dominios propios
  app.enableCors({ origin: true });

  // Todas las rutas quedan bajo /api (ej: /api/iglesias)
  app.setGlobalPrefix('api');

  // Valida todo body y query string contra su DTO antes de llegar al controller:
  // - whitelist: descarta lo que no está declarado en el DTO
  // - forbidNonWhitelisted: y además responde 400 si llega algo no declarado
  //   (así nadie puede colar, por ejemplo, "roles" al registrarse o "autor" en una noticia)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // El puerto se lee de src/conf/config.yaml (clave "port")
  const configService = app.get(ConfigService);
  const port = configService.get<string>('port') || 3000;
  await app.listen(port ?? 3000);
  logger.log(`Microservicio de correos iniciado en puerto ${port || process.env.PORT}`);
}
await bootstrap();
