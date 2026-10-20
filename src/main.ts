import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseExceptionFilter } from './common/filters/mongoose-exception.filter.js';


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
  // CORS_ORIGINS (.env) = dominios permitidos separados por coma, ej:
  //   CORS_ORIGINS=https://iglesia.cl,https://panel.iglesia.cl
  // Sin definir acepta CUALQUIER origen (cómodo en desarrollo; en producción hay que definirlo)
  const origins = process.env.CORS_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean);
  app.enableCors({ origin: origins?.length ? origins : true });
  if (!origins?.length && process.env.STAGE === 'production') {
    logger.warn('CORS_ORIGINS no está definido: la API acepta requests de cualquier dominio');
  }

  // Al apagar (Ctrl+C, un deploy), Nest avisa a los módulos: el de correo espera los
  // envíos en curso y cierra las conexiones SMTP en vez de cortarlas a la mitad
  app.enableShutdownHooks();

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

  // Lo que el DTO no alcanza a validar y rechaza el esquema de Mongo responde 400, no 500.
  // Recibe el HttpAdapter para responder igual que el resto de los errores de Nest
  app.useGlobalFilters(new MongooseExceptionFilter(app.getHttpAdapter()));

  // Puerto: la variable PORT (la que suelen fijar los hostings) o, si no, "port" de config.yaml
  const configService = app.get(ConfigService);
  const port = process.env.PORT || configService.get<string>('port') || 3000;
  await app.listen(port);
  logger.log(`API iniciada en http://localhost:${port}/api`);
}
await bootstrap();
