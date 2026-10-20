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

### Bloqueo por intentos fallidos
Cada contraseña incorrecta suma 1 a `retry`. Con 3, el login responde "blocked". Un login correcto lo vuelve a 0.

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

`menu/menu.config.ts` define, por cada sección, qué roles la ven:

```ts
iglesias: { titulo: 'Iglesias', icono: 'templo', roles: [admin, distrito, iglesia] },
```

Ese mismo dato se usa en **dos lugares**:

1. **El login** devuelve el menú del usuario con `getMenu(user.roles)`.
2. **Los controllers** lo usan como permiso: `@Roles(...MENU.iglesias.roles)`.

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

**Por qué IGLESIA no edita nada todavía:** no hay forma de saber cuál es *su* iglesia. Si pudiera editar, podría editar cualquiera. Cuando el usuario tenga asociado el id de su iglesia, se puede crear una regla "solo la suya".

## Problemas conocidos

- **El login revela qué correos existen.** Responde "does not exist" si el correo no está y "Invalid credentials" si la contraseña está mal. Con eso, cualquiera puede averiguar quién tiene cuenta. Debería responder siempre "Invalid credentials".
- **El chequeo `!user.isActive` en el login nunca se cumple**, porque la consulta ya filtra `isActive: true`. Un usuario desactivado recibe "does not exist".
- **No hay forma de desbloquear un usuario** por intentos fallidos: `UpdateAuthDto` no acepta `retry`. Hoy se hace editando Mongo.
- **No hay límite de intentos por IP.** El bloqueo por usuario no frena a alguien que prueba una contraseña común contra muchos correos. Se resolvería con `@nestjs/throttler`.
- **Las contraseñas aceptan desde 6 caracteres.** Se recomienda mínimo 8.
- Los ids en `/auth/:id` se validan en el servicio y no con `ParseMongoIdPipe` como en los demás módulos (funciona igual, solo es inconsistente).
