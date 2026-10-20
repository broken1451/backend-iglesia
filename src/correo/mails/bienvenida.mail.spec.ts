import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { FileTemplateEngine, InMemoryMailTransport, MailModule, Mailer } from '@nestjs/mail';
import { BienvenidaMail } from './bienvenida.mail.js';

/**
 * Arma un Mailer real con las plantillas reales, pero con InMemoryMailTransport:
 * los correos quedan en memoria (bandeja) en vez de enviarse.
 */
const crearMailer = async (email: Record<string, string> = {}) => {
  const bandeja = new InMemoryMailTransport();
  const module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [() => ({ email })] }),
      MailModule.forRoot({
        transport: bandeja,
        templates: new FileTemplateEngine({ dir: join(import.meta.dirname, '../templates'), layout: 'layout' }),
        from: { name: 'Iglesia', address: 'no-responder@example.com' },
      }),
    ],
  }).compile();
  return { mailer: module.get(Mailer), bandeja };
};

const jose = { name: 'josé maría', last_name: 'muñoz', email: 'jose@iglesia.cl' };

describe('BienvenidaMail', () => {
  it('envía la bienvenida al usuario con su nombre en mayúscula inicial', async () => {
    const { mailer, bandeja } = await crearMailer();
    await mailer.send(BienvenidaMail, { to: jose.email, data: jose });

    const mail = bandeja.assertSent({ to: 'jose@iglesia.cl', mail: BienvenidaMail, template: 'bienvenida' });
    expect(mail.subject).toBe('Bienvenido al panel de la Iglesia');
    expect(mail.from.address).toBe('no-responder@example.com');
    expect(mail.html).toContain('Hola, José María');
    expect(mail.html).toContain('jose@iglesia.cl');
    // El layout envuelve el cuerpo una sola vez, y sus comentarios no viajan en el correo
    expect(mail.html).toContain('Este es un correo automático');
    expect(mail.html?.match(/Hola, José María/g)).toHaveLength(1);
    expect(mail.html).not.toContain('Layout común');
    // La versión de texto plano se genera sola a partir del HTML
    expect(mail.text).toContain('Hola, José María');
  });

  it('escapa el HTML que venga en los datos', async () => {
    const { mailer, bandeja } = await crearMailer();
    await mailer.send(BienvenidaMail, { to: jose.email, data: { ...jose, name: '<script>alert(1)</script>' } });

    const html = bandeja.assertSent({ to: jose.email }).html ?? '';
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('muestra el botón "Ir al panel" solo si email.panelUrl está configurado', async () => {
    const conUrl = await crearMailer({ panelUrl: 'https://panel.iglesia.cl' });
    await conUrl.mailer.send(BienvenidaMail, { to: jose.email, data: jose });
    expect(conUrl.bandeja.assertSent().link('panel.iglesia.cl').href).toBe('https://panel.iglesia.cl/');

    const sinUrl = await crearMailer();
    await sinUrl.mailer.send(BienvenidaMail, { to: jose.email, data: jose });
    expect(sinUrl.bandeja.assertSent().html).not.toContain('Ir al panel');
  });
});
