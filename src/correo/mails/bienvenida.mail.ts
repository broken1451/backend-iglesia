import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Mailable } from '@nestjs/mail';
import { capitalizar } from '../../common/utils/texto.utils.js';

/** Lo que necesita el correo de bienvenida: los datos del usuario recién registrado. */
export interface BienvenidaData {
  name: string;
  last_name: string;
  email: string;
}

/**
 * Correo de bienvenida que se envía al registrarse (lo dispara AuthService.register).
 *
 * Una "clase de correo" de @nestjs/mail: recibe datos y devuelve el asunto y qué
 * plantilla usar con qué valores. No envía nada; eso lo hace el Mailer:
 *
 * ```ts
 * await mailer.send(BienvenidaMail, { to: user.email, data: user });
 * ```
 *
 * Es inyectable, así que puede usar ConfigService (o cualquier otro servicio).
 */
@Injectable()
export class BienvenidaMail implements Mailable<BienvenidaData> {
  constructor(private readonly config: ConfigService) {}

  /**
   * @param user datos del usuario
   * @returns asunto, plantilla (templates/bienvenida.html) y los valores que la plantilla lee
   */
  render(user: BienvenidaData) {
    return {
      subject: 'Bienvenido al panel de la Iglesia',
      template: 'bienvenida',
      context: {
        // Texto que la bandeja muestra junto al asunto (lo usa layout.html)
        preheader: 'Tu cuenta en el panel ya está creada. Esto es lo que sigue.',
        // Los nombres se guardan en minúsculas; en el correo van con mayúscula inicial
        nombre: capitalizar(user.name),
        email: user.email,
        // Si email.panelUrl está en config.yaml, el correo muestra el botón "Ir al panel"
        panelUrl: this.config.get<string>('email.panelUrl') || undefined,
      },
    };
  }
}
