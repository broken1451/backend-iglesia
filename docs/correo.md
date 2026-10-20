# Correo

El envío de correos usa [`@nestjs/mail`](https://docs.nestjs.com/application/mail), el módulo oficial de NestJS. Todo está en `src/correo/`.

## Qué correos se envían hoy

| Correo | Cuándo | Clase | Plantilla |
|---|---|---|---|
| Bienvenida | Al registrarse (`POST /api/auth/register`) | `mails/bienvenida.mail.ts` | `templates/bienvenida.html` |

## Archivos

| Archivo | Qué hace |
|---|---|
| `correo.module.ts` | Configura `MailModule`: transporte, plantillas y remitente por defecto |
| `correo.transport.ts` | Elige cómo se entregan los correos según `email.transport`; `EnvioConCopia` envía y guarda el `.eml` |
| `mails/*.mail.ts` | Una clase por correo: recibe datos y devuelve asunto, plantilla y valores |
| `templates/layout.html` | Encabezado y pie comunes a todos los correos |
| `templates/*.html` | El cuerpo de cada correo |

## Configuración

En `src/conf/config.yaml`:

```yaml
email:
  transport: "smtp"        # file | log | smtp
  guardarCopia: true       # solo smtp: además de enviar, deja el .eml en mails/
  panelUrl: ""             # si tiene valor, la bienvenida muestra "Ir al panel"
  host: "smtp.gmail.com"   # solo smtp
  port: "587"              # solo smtp: 587 (STARTTLS) o 465 (TLS)
  auth:
    user: ""               # mejor en .env: MAIL_USER
    pass: ""               # mejor en .env: MAIL_PASSWORD
  from:
    name: "Iglesia"
    address: ""            # vacío = MAIL_USER (con Gmail tiene que ser esa cuenta)
```

Hoy está configurado para **enviar por Gmail y guardar una copia** en `mails/`. Solo falta llenar `MAIL_USER` y `MAIL_PASSWORD` en `.env` (ver [Enviar de verdad](#enviar-de-verdad-smtp)).

`service` y `subject` (que ya estaban en el YAML) no se usan.

### Transportes

| `transport` | Qué hace | Para |
|---|---|---|
| `file` (si `transport` está vacío) | Guarda cada correo como `.eml` en la carpeta `mails/` (ignorada por git). No envía nada | Desarrollo sin enviar: abre el `.eml` con Mail u Outlook y ves exactamente cómo llegaría |
| `log` | Escribe el correo en la consola | Desarrollo rápido |
| `smtp` | Lo envía de verdad. Con `guardarCopia: true`, además guarda el `.eml` (solo de los que el servidor aceptó) | Probar envíos reales y producción |

### Enviar de verdad (SMTP)

#### Con Gmail (lo que está configurado)

1. Activa la **verificación en 2 pasos** de la cuenta y crea una **contraseña de aplicación** en https://myaccount.google.com/apppasswords (son 16 letras). No sirve la clave normal de la cuenta.
2. En `.env` (no se sube a git):

   ```env
   MAIL_USER=tu-cuenta@gmail.com
   MAIL_PASSWORD=abcdefghijklmnop
   ```

3. Reinicia la API y registra un usuario con un correo real: llega "Bienvenido al panel de la Iglesia" y la copia queda en `mails/`.

#### Con otro proveedor (dominio propio)

1. En `config.yaml`, cambia `host`/`port` por los de tu proveedor y pon `from.address` (por ejemplo `no-responder@tu-dominio.cl`).
2. `MAIL_USER` y `MAIL_PASSWORD` en `.env`, igual que arriba.
3. En el DNS del dominio de `from.address`, configurar **SPF, DKIM y DMARC** (tu proveedor de correo indica los registros). Sin eso, los correos llegan a spam o son rechazados.

#### Si no llega

| En la consola | Causa |
|---|---|
| `Con email.transport "smtp" hay que definir MAIL_USER...` (no arranca) | `MAIL_USER` vacío en `.env` |
| `No se pudo enviar la bienvenida ... 535` / `Invalid login` | Clave normal en vez de contraseña de aplicación, o sin verificación en 2 pasos |
| Nada | El registro respondió 400 (correo ya registrado): no se intenta enviar |

Si no ves el correo en la bandeja de entrada, revisa spam.

La app **no arranca** si `transport` es `smtp` y falta `host` o el remitente: así un error de configuración se nota al desplegar, no cuando falla el primer correo.

Para volver a no enviar nada en desarrollo: `transport: "file"`.

## Cómo funciona el envío

```ts
this.mailer.send(BienvenidaMail, {
  to: { name: 'José María Muñoz', address: 'jose@iglesia.cl' },
  data: { name, last_name, email },
  idempotencyKey: `bienvenida-${user._id}`,
});
```

- **Segundo plano:** el registro no espera el correo. Si el servidor de correo está caído, el usuario igual queda registrado y el error queda en el log (`No se pudo enviar la bienvenida a ...`).
- **Reintentos:** si falla por algo temporal, `@nestjs/mail` reintenta 3 veces (esperando 1 s, 2 s, 4 s... hasta 30 s).
- **`idempotencyKey`:** si un correo se reenviara, el servidor lo reconoce como el mismo y no llega duplicado.
- **Al apagar la app**, se esperan los envíos en curso y se cierran las conexiones SMTP (`app.enableShutdownHooks()` en `main.ts`).
- **Texto plano:** se genera solo a partir del HTML, para clientes que no muestran HTML.

## Plantillas

Son HTML con una sintaxis tipo Handlebars:

| Sintaxis | Qué hace |
|---|---|
| `{{ nombre }}` | Inserta el valor **escapado**: un nombre con `<script>` se muestra como texto |
| `{{{ body }}}` | Inserta HTML sin escapar (solo lo usa el layout) |
| `{{#if panelUrl}} ... {{/if}}` | Muestra un bloque si el valor existe |
| `{{#each items}} ... {{/each}}` | Repite un bloque por cada elemento |
| `{{! comentario }}` | Comentario que **no** viaja en el correo |

Diseño: encabezado azul (`#1f3a5f`) con borde y cruz dorados (`#c9a24b`), fondo crema y pie gris. Para que un correo nuevo combine, copia los estilos de `bienvenida.html` (título, recuadro, pasos numerados, botón).

`preheader` (opcional, en el `context`): la frase que la bandeja de entrada muestra junto al asunto antes de abrir el correo. El layout la incluye oculta.

Reglas:
- No usar comentarios HTML (`<!-- -->`) con `{{ }}` adentro: el motor los reemplaza igual y el contenido viajaría oculto en el correo.
- Estilos **en línea** y estructura con tablas: Outlook y Gmail ignoran las hojas de estilo.
- En desarrollo las plantillas se releen en cada envío: los cambios se ven sin reiniciar. En producción (`STAGE=production`) se compilan una vez.
- Al compilar (`yarn build`), `nest-cli.json` copia `correo/templates` a `dist/`.

## Agregar un correo nuevo

Ejemplo: avisar a un usuario cuando un ADMIN le cambia los roles.

1. **La plantilla** `src/correo/templates/roles-actualizados.html`:

   ```html
   <h1 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:normal;color:#1f3a5f;">Hola, {{ nombre }}</h1>
   <p style="margin:0 0 16px;">Tus permisos en el panel cambiaron. Ahora tienes:</p>
   <ul>
   {{#each roles}}
   <li>{{ this }}</li>
   {{/each}}
   </ul>
   ```

2. **La clase** `src/correo/mails/roles-actualizados.mail.ts`:

   ```ts
   import { Injectable } from '@nestjs/common';
   import type { Mailable } from '@nestjs/mail';
   import { capitalizar } from '../../common/utils/texto.utils.js';

   export interface RolesActualizadosData {
     name: string;
     roles: string[];
   }

   @Injectable()
   export class RolesActualizadosMail implements Mailable<RolesActualizadosData> {
     render({ name, roles }: RolesActualizadosData) {
       return {
         subject: 'Tus permisos en el panel cambiaron',
         template: 'roles-actualizados',
         context: { preheader: 'Revisa tus nuevos permisos.', nombre: capitalizar(name), roles },
       };
     }
   }
   ```

3. **Enviarlo** desde el servicio que corresponda (por ejemplo `AuthService.update`):

   ```ts
   this.mailer
     .send(RolesActualizadosMail, { to: user.email, data: { name: user.name, roles: user.roles } })
     .catch((error) => this.logger.error(`No se pudo avisar a ${user.email}`, error));
   ```

No hay que registrar la clase en ningún módulo: `Mailer` la crea sola.

## Probar

### Ver un correo en desarrollo
Con `transport: "file"` (o `smtp` con `guardarCopia: true`), registra un usuario y abre el `.eml` nuevo en `mails/` (la carpeta aparece con el primer correo):

```bash
open mails/
```

### Tests
`src/correo/mails/bienvenida.mail.spec.ts` usa `InMemoryMailTransport`: los correos quedan en memoria y se revisan con `assertSent()`, sin enviar nada.

```ts
const bandeja = new InMemoryMailTransport();
// ... MailModule.forRoot({ transport: bandeja, templates: ... })
await mailer.send(BienvenidaMail, { to: 'jose@iglesia.cl', data: jose });

const mail = bandeja.assertSent({ to: 'jose@iglesia.cl', mail: BienvenidaMail });
expect(mail.html).toContain('Hola, José');
mail.link('panel');   // el primer link que contenga "panel", como URL
```

```bash
yarn test src/correo
```
