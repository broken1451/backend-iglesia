# Seguridad: autenticación, roles y permisos

Todo vive en `src/auth/`. Se separa en dos preguntas que se responden por separado en cada request:

1. **Autenticación: ¿quién eres?** → el token.
2. **Autorización: ¿qué puedes hacer?** → los roles.

## Archivos

| Archivo | Qué hace |
|---|---|
| `auth.module.ts` | Configura los dos módulos de seguridad (firma de tokens, guards globales) |
| `auth.controller.ts` / `auth.service.ts` | Registro, login y gestión de usuarios |
| `providers/jwt-auth.provider.ts` | Convierte un token válido en el usuario de la BD |
| `policies/roles.policy.ts` | La regla "¿este usuario tiene alguno de estos roles?" |
| `decorators/roles.decorator.ts` | `@Roles(...)`: aplica esa regla a una ruta |
| `decorators/optional-auth.decorator.ts` | `@OptionalAuth()`: ruta abierta que igual reconoce al usuario si manda token |
| `menu/menu.config.ts` | Qué secciones ve cada rol. **Fuente única** del menú y de los permisos |
| `interfaces/role.enum.ts` | Los 4 roles |
| `entities/auth.entity.ts` | El usuario en Mongo |
| `auth.types.ts` | Le dice a la librería que el usuario es de tipo `Auth` y que no hay refresh tokens |

## Autenticación

### Contraseñas
Se guardan con **scrypt** (`PasswordHasher` de la librería), con una sal aleatoria por usuario. Lo que queda en la BD se ve así:

```
$scrypt$ln=17,r=8,p=1$<sal>$<hash>
```

**Por qué así y no cifradas:** un cifrado se puede revertir; un hash no. Si alguien roba la base, no puede recuperar las contraseñas, y como scrypt es lento a propósito, probar millones de contraseñas le resulta carísimo. La sal aleatoria hace que dos usuarios con la misma contraseña tengan hashes distintos.

**Cómo se compara en el login:** no se "descifra" nada. `verify()` toma la sal y los parámetros guardados, pasa la contraseña recibida por el mismo cálculo y compara el resultado en tiempo constante (para no dar pistas por cuánto tarda).

Además:
- La contraseña tiene `select: false` en el esquema: **nunca sale en una consulta** salvo que se pida explícitamente (solo el login lo hace).
- `toJSON` la elimina por si acaso.
- Si algún día se suben los parámetros de scrypt, `needsRehash()` actualiza el hash del usuario en su próximo login.

### Tokens (JWT)
Al hacer login se entrega un `accessToken`. El front lo envía en cada request:

```
Authorization: Bearer eyJhbGciOi...
```

| Configuración | Valor | Por qué |
|---|---|---|
| Firma | `JWT_SECRET` (`.env`), mínimo 32 caracteres | La app no arranca sin él: un secreto vacío o corto permitiría falsificar tokens |
| Duración | `jwt.expiresIn` de `config.yaml`, por defecto `8h` | Una jornada de trabajo en el panel |
| Contenido | Solo `sub` (id del usuario) | Ver abajo |
| Refresh tokens | Desactivados | Al vencer, se vuelve a hacer login. Evita tener que guardar refresh tokens en una BD |

**Por qué el token no lleva los roles:** en cada request, `JwtAuth.validate()` busca al usuario en Mongo por su id. Así:
- Si un ADMIN cambia el rol de alguien, aplica **en el siguiente request**, sin esperar a que venza el token.
- Si se desactiva un usuario, **su token deja de funcionar al instante** (`validate()` solo acepta `isActive: true`).

### Registro
`POST /api/auth/register` es público y **siempre crea el usuario con rol `IGLESIA`**.
- El DTO no acepta `roles`. **Por qué:** si el registro público aceptara roles, cualquiera podría crearse una cuenta ADMIN. Los roles los asigna un ADMIN con `PATCH /api/auth/:id`.
- Nombres y apellidos aceptan tildes y ñ (`\p{L}`), y se guardan en minúsculas.

### Login sin pistas
El login responde **el mismo `401 Invalid credentials`** si el correo no existe, si el usuario está desactivado o si la contraseña es incorrecta.
- **Por qué:** si respondiera distinto ("ese correo no existe"), cualquiera podría averiguar quién tiene cuenta probando correos.
- **También en el tiempo:** con un correo inexistente, `verify()` compara igual contra un hash falso, así la respuesta tarda lo mismo.

### Bloqueo por intentos fallidos
Cada contraseña incorrecta suma 1 a `retry` (con `$inc`, atómico: dos intentos simultáneos suman 2). Con 3 (`MAX_INTENTOS` en `auth.service.ts`) la cuenta queda bloqueada:
- Con la contraseña **correcta**, el login responde `403` explicando que está bloqueada: es el dueño real y necesita saber qué pasa.
- Con una **incorrecta**, sigue respondiendo el `401` de siempre: a quien está adivinando no se le confirma que la cuenta existe.
- **Desbloqueo:** un ADMIN envía `PATCH /api/auth/:id` con `{ "unblock": true }`, o le asigna una contraseña nueva. Un login correcto también vuelve `retry` a 0.

### Secretos
Todo lo secreto va en `.env` (no se sube a git): `JWT_SECRET`, `MAIL_PASSWORD` (la clave del correo, ver [correo.md](correo.md)) y en producción `URI` (incluye la clave de Mongo). Al arrancar, la URI de Mongo se muestra en consola **con la clave oculta** (`mongodb://usuario:****@host`).

### CORS
`CORS_ORIGINS` en `.env` limita qué dominios pueden llamar a la API desde el navegador:

```env
CORS_ORIGINS=https://iglesia.cl,https://panel.iglesia.cl
```

Sin definir acepta cualquier dominio (cómodo en desarrollo). Con `STAGE=production` y sin definir, la API arranca igual pero lo avisa en la consola.

## Autorización

### Los roles

| Rol | Pensado para |
|---|---|
| `ADMIN` | Administración total. **Pasa cualquier `@Roles`** |
| `COMUNICACIONES` | Equipo que publica noticias y actividades |
| `DISTRITO` | Encargados de distrito: gestionan iglesias y actividades |
| `IGLESIA` | Usuario de una iglesia. Rol por defecto; hoy solo consulta |

### Dos guards globales
`auth.module.ts` activa dos guards que corren **en todas las rutas**:

1. **Autenticación:** exige token, salvo en `@Public()`.
2. **Autorización:** exige que la ruta declare quién entra. **Una ruta sin `@Roles`, `@Public` ni `@OptionalAuth` responde 403.**

**Por qué "denegar por defecto":** si alguien agrega un endpoint y olvida protegerlo, queda cerrado en vez de abierto. El error se nota en desarrollo, no cuando ya es tarde.

### Los decoradores

| Decorador | Sin token | Con token | Uso |
|---|---|---|---|
| `@Public()` | ✅ entra | entra, pero **no lee el token** (`user` es `null`) | Login, registro, lista de distritos |
| `@OptionalAuth()` | ✅ entra como visitante | entra **y reconoce al usuario** | GET que muestran más cosas al panel |
| `@Roles()` | 401 | cualquier usuario | `GET /auth/me` |
| `@Roles(A, B)` | 401 | solo roles A o B (o ADMIN) | Crear, editar, borrar |

**`@Roles` en la clase y en el método se suman (Y lógico).** Ejemplo en actividades:

```ts
@Roles(...MENU.actividades.roles)          // clase: ADMIN, COMUNICACIONES, DISTRITO, IGLESIA
export class ActividadesController {
  @Roles(ValidRoles.comunicaciones, ValidRoles.distrito)   // método: además COMUNICACIONES o DISTRITO
  @Post()
```

Para crear hay que cumplir los dos: IGLESIA pasa el de la clase pero no el del método → 403.

`@Public()` y `@OptionalAuth()` en un método **anulan** el `@Roles` de la clase.

### Cómo funciona `@Roles` por dentro

```ts
Can(RolesPolicy, 'hasRole', () => [roles] as const)
```

- `RolesPolicy`: la clase con la regla.
- `'hasRole'`: el método a ejecutar.
- `() => [roles]`: los argumentos que van **después** del usuario. El guard llama `hasRole(usuario, roles)`; el usuario lo pone él desde el token.

### Por qué `@OptionalAuth()` y no `@Public()` en los GET
Con `@Public()` el guard ni siquiera lee el token, así que un usuario del panel con sesión también sería tratado como visitante y no vería sus borradores. `@OptionalAuth()` deja entrar sin token **pero si viene uno, identifica al usuario**. Con eso el mismo endpoint sirve al sitio y al panel:

| | Visitante (y roles sin acceso a la sección) | Panel (roles con acceso) |
|---|---|---|
| Iglesias | solo activas | también desactivadas con `?isActive=false` |
| Actividades | solo activas | también desactivadas con `?isActive=false` |
| Noticias | solo publicadas | también borradores con `?publicado=false` |

El filtro se fuerza **en el servidor**: un visitante que pida `?publicado=false` igual recibe solo las publicadas. Un borrador o una iglesia desactivada consultados por id responden 404, como si no existieran.

Un token vencido o inválido en estas rutas responde 401 (no se trata como visitante). El sitio público no debe enviar token.

## El menú: una sola fuente de verdad

`menu/menu.config.ts` define, por cada sección, qué roles la ven (`roles`), cuáles además crean y editan (`editan`; ADMIN siempre puede) y la `ruta` del panel:

```ts
iglesias: { titulo: 'Iglesias', icono: 'templo', ruta: "iglesias", roles: [admin, distrito, iglesia], editan: [distrito] },
```

Esos mismos datos se usan en **tres lugares**:

1. **El login** devuelve el menú del usuario con `getMenu(user.roles)`: `{ titulo, icono, ruta }` de cada sección.
2. **Los controllers** los usan como permiso: `@Roles(...MENU.iglesias.roles)` en la clase y `@Roles(...MENU.iglesias.editan)` en POST/PATCH.
3. **La pantalla Resumen** (`GET /api/resumen`) usa `hasMenuAccess()` para decidir qué bloques mostrar y `puedeEditar(user, 'iglesias')` para el "Por hacer" y los accesos rápidos: solo propone lo que la API le dejaría hacer.

**Por qué:** si el menú y los permisos estuvieran escritos por separado, tarde o temprano dirían cosas distintas (un rol vería una sección cuya API le responde 403, o al revés). Así, quitarle "Iglesias" a un rol en el menú también le cierra la API.

Un usuario con varios roles ve **la unión** de sus menús.

| Sección | ADMIN | COMUNICACIONES | DISTRITO | IGLESIA |
|---|:-:|:-:|:-:|:-:|
| Resumen | ✅ | ✅ | ✅ | ✅ |
| Iglesias | ✅ | | ✅ | ✅ |
| Noticias | ✅ | ✅ | | |
| Actividades | ✅ | ✅ | ✅ | ✅ |
| Devocional | ✅ | ✅ | | |
| Proyectos | ✅ | ✅ | | |
| Directiva | ✅ | | | |
| Mensajes | ✅ | ✅ | ✅ | ✅ |
| Usuarios y roles | ✅ | | | |
| Configuración | ✅ | ✅ | | |

## Permisos por endpoint

| | Sin token | IGLESIA | DISTRITO | COMUNICACIONES | ADMIN |
|---|:-:|:-:|:-:|:-:|:-:|
| **Iglesias** GET | ✅ (activas) | ✅ | ✅ | ✅ (activas) | ✅ |
| Iglesias POST / PATCH | 401 | 403 | ✅ | 403 | ✅ |
| Iglesias DELETE | 401 | 403 | 403 | 403 | ✅ |
| **Actividades** GET | ✅ (activas) | ✅ | ✅ | ✅ | ✅ |
| Actividades POST / PATCH | 401 | 403 | ✅ | ✅ | ✅ |
| Actividades DELETE | 401 | 403 | 403 | 403 | ✅ |
| **Noticias** GET | ✅ (publicadas) | ✅ (publicadas) | ✅ (publicadas) | ✅ | ✅ |
| Noticias POST / PATCH | 401 | 403 | 403 | ✅ | ✅ |
| Noticias DELETE | 401 | 403 | 403 | 403 | ✅ |
| **Usuarios** (`/auth`, `/auth/:id`) | 401 | 403 | 403 | 403 | ✅ |
| **Mensajes** POST (formulario del sitio) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mensajes GET / PATCH | 401 | ✅ | ✅ | ✅ | ✅ |
| Mensajes DELETE | 401 | 403 | 403 | 403 | ✅ |
| **Resumen** `GET /resumen`, `/resumen/por-hacer` | 401 | ✅ (sus secciones) | ✅ (sus secciones) | ✅ (sus secciones) | ✅ (todo) |

En el Resumen, cada bloque depende del rol: lo que no ve en el menú llega en `null`, y el "Por hacer" y los accesos rápidos solo traen lo que puede editar. "Actividad reciente" solo muestra cambios de las secciones que ve, con el nombre de quien los hizo (nunca su correo).

`?isActive=false` y `?pendientes=true` en los listados solo tienen efecto para los roles que ven la sección en el menú; para el resto se ignoran.

**Por qué IGLESIA no edita nada todavía:** no hay forma de saber cuál es *su* iglesia. Si pudiera editar, podría editar cualquiera. Cuando el usuario tenga asociado el id de su iglesia, se puede crear una regla "solo la suya".

## Problemas conocidos

- **`POST /api/iglesias` está abierto sin login** (el `@Roles(ValidRoles.distrito)` está comentado). Ver [api.md](api.md#post-iglesias).
- **No hay límite de intentos por IP.** El bloqueo por usuario no frena a alguien que prueba una contraseña común contra muchos correos. Se resolvería con `@nestjs/throttler`.
- **Las contraseñas aceptan desde 6 caracteres.** Se recomienda mínimo 8.
- **Un ADMIN puede quitarse su propio rol ADMIN** (o desactivarse); si es el único, nadie más puede administrar y hay que arreglarlo en Mongo.
