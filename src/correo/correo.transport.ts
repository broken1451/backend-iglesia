import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileMailTransport, LogMailTransport, MailTransport, SmtpTransport } from '@nestjs/mail';
import type { MailMessage, MailTransportResult, MailTransportSendOptions } from '@nestjs/mail';

/** Transportes que se pueden elegir con email.transport en config.yaml. */
export const TRANSPORTES = ['file', 'log', 'smtp'] as const;

/**
 * Crea el transporte de correo (el "cómo se entrega") según email.transport de config.yaml:
 *
 * - `file` (por defecto): guarda cada correo como archivo .eml en la carpeta ./mails.
 *   Para desarrollo: no se envía nada de verdad y el .eml se abre con Mail u Outlook
 *   para ver exactamente cómo llegaría.
 * - `log`: escribe el correo en la consola.
 * - `smtp`: lo envía de verdad por un servidor SMTP (Gmail, Microsoft 365, el hosting...).
 *   Con email.guardarCopia: true, además deja el .eml en ./mails (ver EnvioConCopia).
 *
 * Para smtp, el usuario y la clave se leen primero de MAIL_USER / MAIL_PASSWORD del .env
 * (los secretos no van en config.yaml, que sí se sube a git) y si no, de email.auth.
 *
 * @throws Error al arrancar si el transporte no existe o si smtp no tiene host: así un
 *         error de configuración se nota de inmediato y no cuando falla el primer correo
 */
export const crearTransporte = (config: ConfigService): MailTransport => {
  const tipo = config.get<string>('email.transport') || 'file';

  switch (tipo) {
    case 'file':
      return carpetaMails();

    case 'log':
      return new LogMailTransport();

    case 'smtp': {
      const host = config.get<string>('email.host');
      if (!host) throw new Error('email.transport es "smtp" pero falta email.host en config.yaml');

      // En el YAML el puerto puede venir vacío (""): entonces se usa el por defecto (587)
      const port = Number(config.get('email.port')) || undefined;
      const user = process.env.MAIL_USER || config.get<string>('email.auth.user');
      const pass = process.env.MAIL_PASSWORD || config.get<string>('email.auth.pass');

      const smtp = new SmtpTransport({
        host,
        port,
        // 465 = TLS desde el primer byte. Con cualquier otro puerto (587) se usa STARTTLS,
        // que la librería exige por defecto: la clave nunca viaja sin cifrar
        secure: port === 465,
        ...(user && pass && { auth: { user, pass } }),
        // Reutiliza conexiones en vez de abrir una por correo; se cierran al apagar la app
        pool: true,
      });

      return config.get('email.guardarCopia') ? new EnvioConCopia(smtp, carpetaMails()) : smtp;
    }

    default:
      throw new Error(`email.transport "${tipo}" no existe. Opciones: ${TRANSPORTES.join(', ')}`);
  }
};

/** Guarda los correos como .eml en la carpeta ./mails (ignorada por git). */
const carpetaMails = () => new FileMailTransport({ directory: join(process.cwd(), 'mails') });

/**
 * Envía el correo de verdad (SMTP) y, si el servidor lo aceptó, guarda una copia .eml.
 *
 * La copia se escribe solo después de un envío exitoso: si el SMTP falla y el Mailer
 * reintenta, no quedan copias repetidas de intentos que no llegaron. Si falla la copia
 * (disco lleno, sin permisos), el correo ya salió: solo se avisa en el log.
 */
export class EnvioConCopia extends MailTransport {
  private readonly logger = new Logger(EnvioConCopia.name);

  /**
   * @param envio transporte que envía de verdad (SmtpTransport)
   * @param copia transporte que guarda la copia (FileMailTransport)
   */
  constructor(
    private readonly envio: MailTransport,
    private readonly copia: MailTransport,
  ) {
    super();
  }

  async send(message: MailMessage, options: MailTransportSendOptions): Promise<MailTransportResult> {
    const resultado = await this.envio.send(message, options);
    await this.copia
      .send(message, options)
      .catch((error: unknown) => this.logger.warn(`El correo se envió, pero no se pudo guardar la copia: ${String(error)}`));
    return resultado;
  }

  /** Al apagar la app: cierra las conexiones SMTP. */
  async close() {
    await this.envio.close?.();
  }
}
