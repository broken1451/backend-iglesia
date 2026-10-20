import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FileTemplateEngine, MailModule } from '@nestjs/mail';
import { crearTransporte } from './correo.transport.js';

/**
 * Configura el envío de correos con @nestjs/mail (https://docs.nestjs.com/application/mail).
 *
 * MailModule es global: cualquier servicio puede inyectar `Mailer` y enviar con
 * `mailer.send(UnaClaseDeCorreo, { to, data })`. Las clases de correo están en ./mails
 * y sus plantillas HTML en ./templates.
 *
 * Al apagar la app, el módulo espera los envíos en curso y cierra las conexiones SMTP
 * (para eso main.ts llama a enableShutdownHooks()).
 */
@Module({
  imports: [
    MailModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // Si no se define, el remitente es la cuenta SMTP (MAIL_USER): con Gmail tiene que
        // ser la misma cuenta, porque Gmail reemplaza cualquier otro remitente
        const fromAddress = config.get<string>('email.from.address') || process.env.MAIL_USER;
        // Enviando de verdad, el remitente tiene que ser una dirección propia (con SPF/DKIM
        // configurados para su dominio); si no, los correos terminan en spam o rechazados
        if (config.get('email.transport') === 'smtp' && !fromAddress) {
          throw new Error('Con email.transport "smtp" hay que definir MAIL_USER en .env (o email.from.address en config.yaml)');
        }

        return {
        transport: crearTransporte(config),

        // Plantillas .html de ./templates. layout.html envuelve a todas (encabezado y pie).
        // join con import.meta.dirname: las encuentra igual en src/ (desarrollo) que en
        // dist/ (nest-cli.json las copia al compilar).
        // cache: en producción se compilan una sola vez; en desarrollo se releen para ver
        // los cambios sin reiniciar
        templates: new FileTemplateEngine({
          dir: join(import.meta.dirname, 'templates'),
          layout: 'layout',
          cache: process.env.STAGE === 'production',
        }),

        // Remitente por defecto de todos los correos. example.com es un dominio reservado
        // para ejemplos: solo se usa con los transportes file/log, que no envían nada
        from: {
          name: config.get<string>('email.from.name') || 'Iglesia',
          address: fromAddress || 'no-responder@example.com',
        },
        };
      },
    }),
  ],
})
export class CorreoModule {}
