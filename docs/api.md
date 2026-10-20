# Referencia de la API

Todos los ejemplos de este documento son **requests y respuestas reales**, capturados ejecutando la API. Solo se acortaron los tokens (`eyJhbGciOi...`) y algunas listas largas.

- **URL base:** `http://localhost:3500/api` (en desarrollo)
- **Formato:** JSON. Los requests con body llevan `Content-Type: application/json`.
- **Autenticación:** `Authorization: Bearer <accessToken>` (el token se obtiene en el [login](#post-authlogin)).
- **Para probar sin escribir nada:** importa [la colección de Postman](iglesia.postman_collection.json) o abre [requests.http](requests.http) en VS Code. Ver [guia-de-uso.md](guia-de-uso.md#probar-la-api).

## Índice

- [Conceptos comunes](#conceptos-comunes)
  - [Permisos](#permisos) · [Errores](#errores) · [Listados y paginación](#listados-y-paginación) · [Búsqueda](#búsqueda) · [Fechas](#fechas) · [Borrado lógico](#borrado-lógico) · [Campos que agrega la API](#campos-que-agrega-la-api)
- [Auth](#auth--apiauth): [register](#post-authregister) · [login](#post-authlogin) · [me](#get-authme) · [listar](#get-auth) · [ver](#get-authid) · [editar](#patch-authid) · [desactivar](#delete-authid)
- [Iglesias](#iglesias--apiiglesias): [listar](#get-iglesias) · [distritos](#get-iglesiasdistritos) · [ver](#get-iglesiasid) · [crear](#post-iglesias) · [editar](#patch-iglesiasid) · [desactivar](#delete-iglesiasid)
- [Actividades](#actividades--apiactividades): [listar](#get-actividades) · [ver](#get-actividadesid) · [crear](#post-actividades) · [editar](#patch-actividadesid) · [desactivar](#delete-actividadesid)
- [Noticias](#noticias--apinoticias): [listar](#get-noticias) · [ver](#get-noticiasid) · [crear](#post-noticias) · [editar](#patch-noticiasid) · [desactivar](#delete-noticiasid)
- [Salud](#get-api)
- [Resumen de todos los endpoints](#resumen-de-todos-los-endpoints)

---

## Conceptos comunes

### Permisos

Cada endpoint indica quién puede usarlo:

| Etiqueta | Significa |
|---|---|
| 🌐 **Público** | No necesita token |
| 🌐 **Público (el panel ve más)** | No necesita token, pero si se envía uno válido de un rol que gestiona la sección, la respuesta incluye también lo desactivado o los borradores |
| 🔑 **Con sesión** | Cualquier usuario con token válido |
| 🔒 **ROL, ROL** | Solo esos roles. **ADMIN pasa siempre** |

Roles: `ADMIN`, `COMUNICACIONES`, `DISTRITO`, `IGLESIA`. El detalle de por qué cada rol puede lo que puede está en [seguridad.md](seguridad.md).

### Errores

Todos los errores tienen la misma forma:

```json
{ "message": "texto o lista de textos", "error": "Bad Request", "statusCode": 400 }
```

| Código | Cuándo | Ejemplo de `message` |
|---|---|---|
| **400** | El body o los parámetros no cumplen las reglas | `["email must be an email", "password must be longer than or equal to 6 characters"]` |
| **400** | Se envió un campo que no existe en el endpoint | `["property roles should not exist"]` |
| **400** | Id con formato inválido | `"abc is not a valid id"` |
| **400** | Regla de negocio (duplicado, fechas, coordenadas) | `"lat and lng must be sent together"` |
| **400** | Un campo obligatorio enviado como `null` en un PATCH | `["The titulo is required"]` |
| **401** | Sin token | `"Unauthorized"` (con `"errorCode": "missing_credentials"`) |
| **401** | Token mal formado, vencido o de un usuario desactivado | `"malformed token"` / `"unknown subject"` |
| **401** | Login: correo no registrado o contraseña incorrecta (misma respuesta) | `"Invalid credentials"` |
| **403** | Login: cuenta bloqueada por intentos fallidos | `"The user is blocked after too many failed attempts; an ADMIN must unblock it"` |
| **403** | Con token, pero el rol no tiene permiso | `"Forbidden"` |
| **404** | No existe, o el visitante no puede verlo (desactivado o borrador) | `"Iglesia with id 6ad7... not found"` |

Cuando `message` es una lista, trae **todos** los problemas a la vez, para mostrarlos juntos en el formulario.

**Cualquier campo que no esté en la tabla de un endpoint se rechaza con 400.** Así no se puede, por ejemplo, darse roles al registrarse o firmar una noticia a nombre de otro.

### Listados y paginación

Todos los `GET` que devuelven listas aceptan:

| Parámetro | Tipo | Default | Reglas |
|---|---|---|---|
| `limit` | número | 20 | Entre 1 y 100 |
| `offset` | número | 0 | Cuántos resultados saltar |
| `search` | texto | | Busca dentro del nombre o título |

Y responden siempre con esta forma:

```json
{
  "total": 5,
  "limit": 2,
  "offset": 0,
  "data": [ { ... }, { ... } ]
}
```

- `total` es cuántos resultados cumplen los filtros en total (no solo los de esta página).
- Página `n` (empezando en 1): `offset = (n - 1) * limit`. Cantidad de páginas: `Math.ceil(total / limit)`.

`limit` fuera de rango:

```
GET /api/iglesias?limit=500
```

```json
{ "message": ["limit must not be greater than 100"], "error": "Bad Request", "statusCode": 400 }
```

### Búsqueda

`search` y los filtros de `distrito` **no distinguen mayúsculas ni tildes**:

| Se escribe | Encuentra |
|---|---|
| `?search=concepcion` | "Iglesia Bautista de Concepción" |
| `?search=nunoa` | "Iglesia de Ñuñoa" |
| `?distrito=araucania` | "Araucanía" (exacto: no trae "Araucanía Norte") |

Los caracteres especiales se buscan tal cual: `?search=(central` no rompe nada.

### Fechas

- **Enviar** las fechas en formato ISO **con zona horaria**: `"2026-10-31T19:00:00-03:00"`. Sin zona, se interpretan como UTC y la hora queda corrida.
- **La API responde en UTC**: lo anterior vuelve como `"2026-10-31T22:00:00.000Z"`.
- **Mostrarlas** en hora de Chile: `new Date(fecha).toLocaleString('es-CL', { timeZone: 'America/Santiago' })`. Ver [guia-de-uso.md](guia-de-uso.md#mostrar-fechas).

### Borrado lógico

`DELETE` nunca borra: marca el registro con `isActive: false`.
- Deja de aparecer en el sitio (los visitantes reciben 404).
- El panel lo puede listar con `?isActive=false` (iglesias, actividades y noticias).
- Se recupera con `PATCH` enviando `{ "isActive": true }`.

### Campos que agrega la API

Además de lo que se envía, cada registro trae:

| Campo | Qué es |
|---|---|
| `_id` | Identificador. Es el que va en las rutas `/:id` |
| `isActive` | `false` si fue desactivado |
| `created_at` | Fecha de creación (UTC) |
| `update_at` | Fecha del último cambio (UTC) |

---

## Auth — `/api/auth`

Usuarios del panel: registro, login y gestión.

### Objeto usuario

| Campo | Tipo | Descripción |
|---|---|---|
| `_id` | texto | Id del usuario |
| `name`, `last_name` | texto | En minúsculas |
| `email` | texto | En minúsculas, único |
| `roles` | lista | `ADMIN`, `COMUNICACIONES`, `DISTRITO`, `IGLESIA` |
| `isActive` | booleano | `false` = desactivado, no puede entrar |
| `retry` | número | Intentos de login fallidos seguidos. Con 3, la cuenta se bloquea |
| `update_at_login` | fecha | Último login correcto |

La contraseña **nunca** viene en las respuestas.

---

### `POST /auth/register`

🌐 **Público** — Crea una cuenta. **Siempre con rol `IGLESIA`**; los demás roles los asigna un ADMIN. Deja la sesión iniciada (devuelve token).

**Body**

| Campo | Tipo | Obligatorio | Reglas |
|---|---|:-:|---|
| `name` | texto | ✅ | Solo letras (incluye tildes y ñ) y espacios |
| `last_name` | texto | ✅ | Solo letras y espacios |
| `email` | texto | ✅ | Email válido. Único (sin distinguir mayúsculas) |
| `password` | texto | ✅ | Entre 6 y 50 caracteres |

**Ejemplo**

```bash
curl -X POST http://localhost:3500/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"José","last_name":"Muñoz","email":"Jose.Munoz@Iglesia.cl","password":"secreto123"}'
```

**Respuesta `201`**

```json
{
  "user": {
    "name": "josé",
    "last_name": "muñoz",
    "email": "jose.munoz@iglesia.cl",
    "roles": ["IGLESIA"],
    "isActive": true,
    "retry": 0,
    "_id": "6ad75c2ee4515633ec65ee41",
    "created_at": "2026-10-20T12:18:54.578Z",
    "update_at": "2026-10-20T12:18:54.578Z",
    "update_at_login": "2026-10-20T12:18:54.578Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5...",
  "expiresIn": 28800
}
```

Nombre, apellido y correo se guardan en minúsculas. `expiresIn` está en segundos (28800 = 8 horas).

📧 Además se envía el **correo de bienvenida** en segundo plano: la respuesta no lo espera, y si el envío falla el usuario queda registrado igual (el error queda en la consola). Ver [correo.md](correo.md).

**Errores**

Intentar darse roles → `400`:

```json
{ "message": ["property roles should not exist"], "error": "Bad Request", "statusCode": 400 }
```

Correo ya registrado (aunque cambien mayúsculas) → `400`:

```json
{ "message": "The user already exists in the database with the email jose.munoz@iglesia.cl", "error": "Bad Request", "statusCode": 400 }
```

Datos inválidos (`{"name":"J0sé","last_name":"","email":"no-es-correo","password":"123"}`) → `400`:

```json
{
  "message": [
    "The name must contain only letters and spaces.",
    "The last_name must contain only letters and spaces.",
    "last_name should not be empty",
    "email must be an email",
    "password must be longer than or equal to 6 characters"
  ],
  "error": "Bad Request",
  "statusCode": 400
}
```

---

### `POST /auth/login`

🌐 **Público** — Inicia sesión. Devuelve el token y **el menú que corresponde a los roles del usuario**.

**Body**

| Campo | Tipo | Obligatorio | Reglas |
|---|---|:-:|---|
| `email` | texto | ✅ | Email válido |
| `password` | texto | ✅ | Máximo 50 caracteres |

**Ejemplo**

```bash
curl -X POST http://localhost:3500/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@iglesia.cl","password":"secreto123"}'
```

**Respuesta `200`** (usuario ADMIN)

```json
{
  "user": {
    "_id": "6ad75c2ee4515633ec65ee42",
    "name": "ana",
    "last_name": "prueba",
    "email": "admin@iglesia.cl",
    "roles": ["ADMIN"],
    "isActive": true,
    "retry": 0,
    "created_at": "2026-10-20T12:18:54.879Z",
    "update_at": "2026-10-20T12:18:57.879Z",
    "update_at_login": "2026-10-20T12:18:57.878Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5...",
  "expiresIn": 28800,
  "menu": [
    { "titulo": "Resumen", "icono": "grafico" },
    { "titulo": "Iglesias", "icono": "templo" },
    { "titulo": "Noticias", "icono": "diario" },
    { "titulo": "Actividades", "icono": "calendario" },
    { "titulo": "Devocional", "icono": "libro" },
    { "titulo": "Proyectos", "icono": "semilla" },
    { "titulo": "Directiva", "icono": "usuarios" },
    { "titulo": "Mensajes", "icono": "bandeja" },
    { "titulo": "Usuarios y roles", "icono": "llave" },
    { "titulo": "Configuración", "icono": "ajustes" }
  ]
}
```

**El menú según el rol**

| Rol | `menu` |
|---|---|
| ADMIN | Las 10 secciones (arriba) |
| COMUNICACIONES | Resumen, Noticias, Actividades, Devocional, Proyectos, Mensajes, Configuración |
| DISTRITO | Resumen, Iglesias, Actividades, Mensajes |
| IGLESIA | Resumen, Iglesias, Actividades, Mensajes |

Con **varios roles** se recibe la unión. Por ejemplo, `["DISTRITO", "COMUNICACIONES"]` recibe: Resumen, Iglesias, Noticias, Actividades, Devocional, Proyectos, Mensajes, Configuración.

**Errores**

Correo no registrado, usuario desactivado o contraseña incorrecta → `401`, **siempre la misma respuesta** (así nadie puede averiguar qué correos tienen cuenta). Una contraseña incorrecta además suma 1 a `retry`:

```json
{ "message": "Invalid credentials", "error": "Unauthorized", "statusCode": 401 }
```

Cuenta bloqueada por 3 intentos fallidos, **con la contraseña correcta** → `403` (con una contraseña incorrecta sigue respondiendo el `401` de arriba):

```json
{ "message": "The user is blocked after too many failed attempts; an ADMIN must unblock it", "error": "Forbidden", "statusCode": 403 }
```

Un login correcto vuelve `retry` a 0. Una cuenta bloqueada la desbloquea un ADMIN con [`PATCH /auth/:id`](#patch-authid) y `{ "unblock": true }`.

---

### `GET /auth/me`

🔑 **Con sesión** — Devuelve el usuario dueño del token. Sirve para que el panel sepa quién está conectado al recargar la página.

```bash
curl http://localhost:3500/api/auth/me \
  -H "Authorization: Bearer TU_TOKEN"
```

**Respuesta `200`**

```json
{
  "_id": "6ad75c30e4515633ec65ee45",
  "name": "ignacio",
  "last_name": "prueba",
  "email": "iglesia@iglesia.cl",
  "roles": ["IGLESIA"],
  "isActive": true,
  "retry": 1,
  "created_at": "2026-10-20T12:18:56.911Z",
  "update_at": "2026-10-20T12:18:58.976Z",
  "update_at_login": "2026-10-20T12:18:58.706Z"
}
```

**Errores**

Sin token → `401`:

```json
{ "message": "Unauthorized", "statusCode": 401, "errorCode": "missing_credentials" }
```

Token mal formado → `401`:

```json
{ "message": "malformed token", "error": "Unauthorized", "statusCode": 401 }
```

---

### `GET /auth`

🔒 **ADMIN** — Lista todos los usuarios activos (sin paginar).

```bash
curl http://localhost:3500/api/auth \
  -H "Authorization: Bearer TOKEN_ADMIN"
```

**Respuesta `200`:** lista de [usuarios](#objeto-usuario).

Con otro rol → `403`:

```json
{ "message": "Forbidden", "statusCode": 403 }
```

---

### `GET /auth/:id`

🔒 **ADMIN** — Un usuario, esté activo o no.

```bash
curl http://localhost:3500/api/auth/6ad75c2ee4515633ec65ee41 \
  -H "Authorization: Bearer TOKEN_ADMIN"
```

**Respuesta `200`:** un [usuario](#objeto-usuario). **Errores:** `400` id inválido, `404` no existe.

---

### `PATCH /auth/:id`

🔒 **ADMIN** — Edita un usuario. Se envía solo lo que cambia.

**Body** (todo opcional)

| Campo | Tipo | Reglas |
|---|---|---|
| `name`, `last_name` | texto | Solo letras y espacios |
| `email` | texto | Email válido |
| `password` | texto | 6 a 50 caracteres. Se guarda el nuevo hash |
| `roles` | lista | **Reemplaza** todos los roles. Solo `ADMIN`, `COMUNICACIONES`, `DISTRITO`, `IGLESIA`, sin repetir |
| `isActive` | booleano | `false` desactiva, `true` reactiva |
| `unblock` | booleano | `true` desbloquea una cuenta bloqueada por intentos fallidos (`retry` vuelve a 0). Asignar una `password` nueva también la desbloquea |

**Ejemplo: asignar roles**

```bash
curl -X PATCH http://localhost:3500/api/auth/6ad75c2ee4515633ec65ee41 \
  -H "Authorization: Bearer TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"roles":["DISTRITO","COMUNICACIONES"]}'
```

**Respuesta `200`**

```json
{
  "_id": "6ad75c2ee4515633ec65ee41",
  "name": "josé",
  "last_name": "muñoz",
  "email": "jose.munoz@iglesia.cl",
  "roles": ["DISTRITO", "COMUNICACIONES"],
  "isActive": true,
  "retry": 0,
  "created_at": "2026-10-20T12:18:54.578Z",
  "update_at": "2026-10-20T12:18:59.001Z",
  "update_at_login": "2026-10-20T12:18:54.578Z"
}
```

El cambio aplica **en el siguiente request** del usuario: no necesita volver a hacer login (aunque el menú nuevo lo recibe en su próximo login).

**Ejemplo: reactivar**

```json
{ "isActive": true }
```

**Ejemplo: desbloquear** (después de 3 intentos fallidos)

```json
{ "unblock": true }
```

**Errores**

Correo que ya usa otro usuario → `400`:

```json
{ "message": "The email ana@iglesia.cl is already in use", "error": "Bad Request", "statusCode": 400 }
```

Rol que no existe → `400`:

```json
{ "message": ["each value in roles must be one of the following values: ADMIN, COMUNICACIONES, DISTRITO, IGLESIA"], "error": "Bad Request", "statusCode": 400 }
```

---

### `DELETE /auth/:id`

🔒 **ADMIN** — Desactiva un usuario. **Sus tokens dejan de funcionar de inmediato** (responden 401 `unknown subject`).

```bash
curl -X DELETE http://localhost:3500/api/auth/6ad75c2ee4515633ec65ee41 \
  -H "Authorization: Bearer TOKEN_ADMIN"
```

**Respuesta `200`**

```json
{ "message": "User 6ad75c2ee4515633ec65ee41 deactivated" }
```

Se reactiva con `PATCH /auth/:id` y `{ "isActive": true }`.

---

## Iglesias — `/api/iglesias`

Directorio de iglesias del sitio.

### Objeto iglesia

| Campo | Tipo | Descripción |
|---|---|---|
| `distrito` | texto | Ej. "Araucanía" |
| `name` | texto | Nombre. Único dentro del distrito |
| `direccion` | texto | Dirección postal |
| `reuniones` | texto | Horarios, texto libre |
| `encargado` | texto | Pastor o encargado |
| `email` | texto | Correo de contacto, en minúsculas |
| `lat`, `lng` | número | Coordenadas para el mapa. Siempre las dos o ninguna |

Más los [campos que agrega la API](#campos-que-agrega-la-api). Los campos opcionales que no se enviaron no aparecen en la respuesta.

---

### `GET /iglesias`

🌐 **Público (el panel ve más)** — Lista paginada, ordenada por distrito y luego por nombre.

**Parámetros**

| Parámetro | Descripción |
|---|---|
| `distrito` | Distrito exacto, sin mayúsculas ni tildes |
| `search` | Busca en el nombre |
| `isActive` | `false` lista las desactivadas. **Solo con token de ADMIN, DISTRITO o IGLESIA**; para el resto se ignora y siempre ven las activas |
| `limit`, `offset` | [Paginación](#listados-y-paginación) |

**Ejemplo: filtrar**

```bash
curl "http://localhost:3500/api/iglesias?distrito=araucania&search=temuco"
```

**Respuesta `200`**

```json
{
  "total": 1,
  "limit": 20,
  "offset": 0,
  "data": [
    {
      "_id": "6ad75c33e4515633ec65ee46",
      "distrito": "Araucanía",
      "name": "Iglesia Bautista de Temuco",
      "direccion": "Av. Alemania 0450, Temuco",
      "reuniones": "Domingo 11:00, Miércoles 19:30",
      "encargado": "Pastor Juan Pérez",
      "email": "contacto@iglesiatemuco.cl",
      "lat": -38.7359,
      "lng": -72.5904,
      "isActive": true,
      "created_at": "2026-10-20T12:18:59.287Z",
      "update_at": "2026-10-20T12:18:59.287Z"
    }
  ]
}
```

**Ejemplo: paginar**

```bash
curl "http://localhost:3500/api/iglesias?limit=2"
```

```json
{
  "total": 5,
  "limit": 2,
  "offset": 0,
  "data": [
    { "_id": "6ad75c33e4515633ec65ee47", "distrito": "Araucanía", "name": "Iglesia Bautista de Angol", "isActive": true, "created_at": "...", "update_at": "..." },
    { "_id": "6ad75c33e4515633ec65ee46", "distrito": "Araucanía", "name": "Iglesia Bautista de Temuco", "...": "..." }
  ]
}
```

**Ejemplo: el panel busca las desactivadas**

```bash
curl "http://localhost:3500/api/iglesias?isActive=false" \
  -H "Authorization: Bearer TOKEN_DISTRITO"
```

```json
{
  "total": 1,
  "limit": 20,
  "offset": 0,
  "data": [
    { "_id": "6ad75c33e4515633ec65ee4a", "distrito": "Biobío", "name": "Iglesia Cerrada", "isActive": false, "created_at": "2026-10-20T12:18:59.302Z", "update_at": "2026-10-20T12:18:59.306Z" }
  ]
}
```

El mismo request **sin token** devuelve las activas: un visitante no puede ver lo desactivado aunque lo pida.

---

### `GET /iglesias/distritos`

🌐 **Público** — Los distritos que tienen al menos una iglesia activa, con cuántas tiene cada uno. Pensado para el filtro de distritos del sitio. Orden alfabético español ("Ñuble" va después de "Norte").

```bash
curl http://localhost:3500/api/iglesias/distritos
```

**Respuesta `200`**

```json
[
  { "total": 2, "distrito": "Araucanía" },
  { "total": 1, "distrito": "Biobío" },
  { "total": 1, "distrito": "Norte" },
  { "total": 1, "distrito": "Ñuble" }
]
```

---

### `GET /iglesias/:id`

🌐 **Público (el panel ve más)** — Una iglesia. Para visitantes, una iglesia desactivada responde 404; el panel sí la ve.

```bash
curl http://localhost:3500/api/iglesias/6ad75c33e4515633ec65ee46
```

**Respuesta `200`:** una [iglesia](#objeto-iglesia).

**Errores**

Id con formato inválido → `400`:

```json
{ "message": "abc is not a valid id", "error": "Bad Request", "statusCode": 400 }
```

No existe, o está desactivada y quien consulta es un visitante → `404`:

```json
{ "message": "Iglesia with id 6ad75c33e4515633ec65ee4a not found", "error": "Not Found", "statusCode": 404 }
```

---

### `POST /iglesias`

🔒 **DISTRITO** (y ADMIN) — Crea una iglesia.

> ⚠ **Estado actual: este endpoint está abierto sin login.** En el código, `@Roles(ValidRoles.distrito)` está comentado y en su lugar hay `@OptionalAuth()`, así que cualquiera puede crear iglesias (verificado: sin token responde `201`). Lo previsto es que solo DISTRITO y ADMIN puedan hacerlo. Ver [iglesias.controller.ts](../src/iglesias/iglesias.controller.ts).

**Body**

| Campo | Tipo | Obligatorio | Reglas |
|---|---|:-:|---|
| `distrito` | texto | ✅ | Máx. 100 |
| `name` | texto | ✅ | Máx. 150. **Único dentro del distrito** (sin distinguir mayúsculas ni espacios extra) |
| `direccion` | texto | | Máx. 250 |
| `reuniones` | texto | | Máx. 250 |
| `encargado` | texto | | Máx. 150 |
| `email` | texto | | Email válido. Se guarda en minúsculas |
| `lat` | número | | Entre -90 y 90. **Junto con `lng`** |
| `lng` | número | | Entre -180 y 180. **Junto con `lat`** |

Los espacios repetidos o en los extremos de `distrito`, `name`, `direccion` y `encargado` se eliminan antes de guardar. `lat` y `lng` también se aceptan como texto numérico (`"-38.73"`), pero lo correcto es enviarlos como número.

**Ejemplo**

```bash
curl -X POST http://localhost:3500/api/iglesias \
  -H "Authorization: Bearer TOKEN_DISTRITO" \
  -H "Content-Type: application/json" \
  -d '{"distrito":"Araucanía","name":"Iglesia Bautista de Temuco","direccion":"Av. Alemania 0450, Temuco","reuniones":"Domingo 11:00, Miércoles 19:30","encargado":"Pastor Juan Pérez","email":"Contacto@IglesiaTemuco.cl","lat":-38.7359,"lng":-72.5904}'
```

**Respuesta `201`**

```json
{
  "distrito": "Araucanía",
  "name": "Iglesia Bautista de Temuco",
  "direccion": "Av. Alemania 0450, Temuco",
  "reuniones": "Domingo 11:00, Miércoles 19:30",
  "encargado": "Pastor Juan Pérez",
  "email": "contacto@iglesiatemuco.cl",
  "lat": -38.7359,
  "lng": -72.5904,
  "isActive": true,
  "_id": "6ad75c33e4515633ec65ee46",
  "created_at": "2026-10-20T12:18:59.287Z",
  "update_at": "2026-10-20T12:18:59.287Z"
}
```

Body mínimo:

```json
{ "distrito": "Araucanía", "name": "Iglesia Bautista de Angol" }
```

**Errores**

Nombre repetido en el distrito. Este body choca con la de Temuco, aunque cambie mayúsculas, tildes del distrito y espacios: `{"distrito":"araucanía","name":"  IGLESIA   BAUTISTA DE TEMUCO "}` → `400`:

```json
{ "message": "An iglesia with that name already exists in that distrito", "error": "Bad Request", "statusCode": 400 }
```

Una coordenada sin la otra → `400`:

```json
{ "message": "lat and lng must be sent together", "error": "Bad Request", "statusCode": 400 }
```

Campo vacío, email inválido y un campo que no existe (`web`) → `400`:

```json
{ "message": ["property web should not exist", "distrito should not be empty", "email must be an email"], "error": "Bad Request", "statusCode": 400 }
```

---

### `PATCH /iglesias/:id`

🔒 **DISTRITO** (y ADMIN) — Edita una iglesia. Se envía solo lo que cambia; lo demás queda igual.

**Body:** cualquier campo de [POST](#post-iglesias) (todos opcionales), más:

| Campo | Tipo | Descripción |
|---|---|---|
| `isActive` | booleano | `true` reactiva una iglesia desactivada |

**Ejemplo: cambiar horario**

```bash
curl -X PATCH http://localhost:3500/api/iglesias/6ad75c33e4515633ec65ee46 \
  -H "Authorization: Bearer TOKEN_DISTRITO" \
  -H "Content-Type: application/json" \
  -d '{"reuniones":"Domingo 10:30"}'
```

**Respuesta `200`:** la iglesia completa ya actualizada (`"reuniones": "Domingo 10:30"`, el resto sin cambios).

**Otros bodies útiles**

Borrar la ubicación (las dos a la vez):

```json
{ "lat": null, "lng": null }
```

Reactivar:

```json
{ "isActive": true }
```

Cambiar solo `lat` está permitido si la iglesia ya tenía `lng`. Si no tenía ubicación, hay que mandar las dos.

**Errores:** los mismos de [POST](#post-iglesias), más `404` si no existe y `403` con otro rol:

```json
{ "message": "Forbidden", "statusCode": 403 }
```

---

### `DELETE /iglesias/:id`

🔒 **ADMIN** — Desactiva la iglesia ([borrado lógico](#borrado-lógico)): deja de verse en el sitio.

```bash
curl -X DELETE http://localhost:3500/api/iglesias/6ad75c33e4515633ec65ee4a \
  -H "Authorization: Bearer TOKEN_ADMIN"
```

**Respuesta `200`**

```json
{ "message": "Iglesia 6ad75c33e4515633ec65ee4a deactivated" }
```

**Errores:** `403` con un rol que no sea ADMIN (incluido DISTRITO), `404` si no existe o ya estaba desactivada.

---

## Actividades — `/api/actividades`

Calendario de actividades del sitio.

### Objeto actividad

| Campo | Tipo | En la tarjeta del sitio |
|---|---|---|
| `titulo` | texto | Título |
| `descripcion` | texto | Texto corto |
| `fecha_inicio` | fecha | Cuadro "24 OCT", hora "19:00 h", agrupación por mes |
| `fecha_fin` | fecha | "Hasta el 25 de octubre" (solo actividades de varios días) |
| `lugar` | texto | 📍 "Temuco" / "En línea" |
| `distrito` | texto | Etiqueta. `"Nacional"` si es para todos |
| `inscripcion_url` | texto | Si existe, botón "Inscribirme" |

Más los [campos que agrega la API](#campos-que-agrega-la-api).

---

### `GET /actividades`

🌐 **Público (el panel ve más)** — Lista paginada, **ordenada por `fecha_inicio` ascendente** (lista para agrupar por mes).

**Parámetros**

| Parámetro | Descripción |
|---|---|
| `desde` | Fecha ISO. Actividades **todavía vigentes** desde esa fecha: incluye las que empezaron antes pero aún no terminan. Con solo el día (`2026-10-01`) cuenta desde las 00:00 de ese día en Chile |
| `hasta` | Fecha ISO. Actividades que **empiezan** hasta esa fecha. Con solo el día (`2026-12-31`) **incluye todo ese día** en hora de Chile |
| `distrito` | Exacto, sin mayúsculas ni tildes. `nacional` trae las nacionales |
| `search` | Busca en el título |
| `isActive` | `false` lista las desactivadas (solo panel: ADMIN, COMUNICACIONES, DISTRITO, IGLESIA) |
| `limit`, `offset` | [Paginación](#listados-y-paginación) |

**Ejemplo: próximas actividades para el sitio**

```bash
curl "http://localhost:3500/api/actividades?desde=2026-10-01&limit=10"
```

**Respuesta `200`**

```json
{
  "total": 3,
  "limit": 10,
  "offset": 0,
  "data": [
    {
      "_id": "6ad75c33e4515633ec65ee4d",
      "titulo": "Retiro de jóvenes",
      "descripcion": "Dos días de alabanza, enseñanza y convivencia para jóvenes de 15 a 30 años.",
      "fecha_inicio": "2026-10-24T12:00:00.000Z",
      "fecha_fin": "2026-10-25T21:00:00.000Z",
      "lugar": "Temuco",
      "distrito": "Araucanía",
      "inscripcion_url": "https://forms.gle/retiro2026",
      "isActive": true,
      "created_at": "2026-10-20T12:18:59.364Z",
      "update_at": "2026-10-20T12:18:59.364Z"
    },
    {
      "_id": "6ad75c33e4515633ec65ee4f",
      "titulo": "Culto unido de Reforma",
      "fecha_inicio": "2026-10-31T22:00:00.000Z",
      "lugar": "Santiago",
      "distrito": "Metropolitano",
      "isActive": true,
      "created_at": "2026-10-20T12:18:59.371Z",
      "update_at": "2026-10-20T12:18:59.371Z"
    },
    {
      "_id": "6ad75c33e4515633ec65ee4e",
      "titulo": "Reunión de la Junta de Pastores",
      "descripcion": "Reunión ordinaria. El enlace se envía por correo a los pastores.",
      "fecha_inicio": "2026-11-14T13:00:00.000Z",
      "lugar": "En línea",
      "distrito": "Nacional",
      "isActive": true,
      "created_at": "2026-10-20T12:18:59.367Z",
      "update_at": "2026-10-20T12:18:59.367Z"
    }
  ]
}
```

Fíjate en las horas: el retiro se envió como `09:00-03:00` y vuelve como `12:00Z` (UTC). Al mostrarlo en hora de Chile vuelve a ser 09:00.

**Ejemplo: actividades en curso.** `?desde=2026-10-25` **sigue trayendo el retiro**, porque empezó el 24 pero termina el 25.

**Ejemplo: solo nacionales.** `?distrito=nacional` → solo "Reunión de la Junta de Pastores".

---

### `GET /actividades/:id`

🌐 **Público (el panel ve más)** — Una actividad. Para visitantes, una desactivada responde 404.

```bash
curl http://localhost:3500/api/actividades/6ad75c33e4515633ec65ee4d
```

**Respuesta `200`:** una [actividad](#objeto-actividad).

Desactivada, consultada por un visitante → `404`:

```json
{ "message": "Actividad with id 6ad75c33e4515633ec65ee4d not found", "error": "Not Found", "statusCode": 404 }
```

---

### `POST /actividades`

🔒 **COMUNICACIONES, DISTRITO** (y ADMIN) — Crea una actividad.

**Body**

| Campo | Tipo | Obligatorio | Reglas |
|---|---|:-:|---|
| `titulo` | texto | ✅ | Máx. 100 |
| `descripcion` | texto | | Máx. 500 |
| `fecha_inicio` | fecha ISO | ✅ | **Con zona horaria** |
| `fecha_fin` | fecha ISO | | No puede ser anterior a `fecha_inicio` |
| `lugar` | texto | | Máx. 100 |
| `distrito` | texto | | Máx. 100. Sin él (o vacío) → `"Nacional"` |
| `inscripcion_url` | texto | | URL válida |

**Ejemplo: actividad de varios días con inscripción**

```bash
curl -X POST http://localhost:3500/api/actividades \
  -H "Authorization: Bearer TOKEN_COMUNICACIONES" \
  -H "Content-Type: application/json" \
  -d '{"titulo":"Retiro de jóvenes","descripcion":"Dos días de alabanza, enseñanza y convivencia para jóvenes de 15 a 30 años.","fecha_inicio":"2026-10-24T09:00:00-03:00","fecha_fin":"2026-10-25T18:00:00-03:00","lugar":"Temuco","distrito":"Araucanía","inscripcion_url":"https://forms.gle/retiro2026"}'
```

**Respuesta `201`**

```json
{
  "titulo": "Retiro de jóvenes",
  "descripcion": "Dos días de alabanza, enseñanza y convivencia para jóvenes de 15 a 30 años.",
  "fecha_inicio": "2026-10-24T12:00:00.000Z",
  "fecha_fin": "2026-10-25T21:00:00.000Z",
  "lugar": "Temuco",
  "distrito": "Araucanía",
  "inscripcion_url": "https://forms.gle/retiro2026",
  "isActive": true,
  "_id": "6ad75c33e4515633ec65ee4d",
  "created_at": "2026-10-20T12:18:59.364Z",
  "update_at": "2026-10-20T12:18:59.364Z"
}
```

**Ejemplo: actividad nacional de un día** (sin `distrito` ni `fecha_fin`)

```json
{
  "titulo": "Reunión de la Junta de Pastores",
  "descripcion": "Reunión ordinaria. El enlace se envía por correo a los pastores.",
  "fecha_inicio": "2026-11-14T10:00:00-03:00",
  "lugar": "En línea"
}
```

Responde `201` con `"distrito": "Nacional"`.

**Errores**

`fecha_fin` antes de `fecha_inicio` → `400`:

```json
{ "message": "fecha_fin must be after fecha_inicio", "error": "Bad Request", "statusCode": 400 }
```

Con rol IGLESIA → `403`:

```json
{ "message": "Forbidden", "statusCode": 403 }
```

---

### `PATCH /actividades/:id`

🔒 **COMUNICACIONES, DISTRITO** (y ADMIN) — Edita una actividad. Se envía solo lo que cambia.

**Body:** cualquier campo de [POST](#post-actividades) (todos opcionales), más `isActive`.

**Ejemplo: cambiar el lugar**

```bash
curl -X PATCH http://localhost:3500/api/actividades/6ad75c33e4515633ec65ee4d \
  -H "Authorization: Bearer TOKEN_DISTRITO" \
  -H "Content-Type: application/json" \
  -d '{"lugar":"Temuco, Camping Las Araucarias"}'
```

**Respuesta `200`:** la actividad completa, con `"lugar": "Temuco, Camping Las Araucarias"` y todo lo demás igual.

**Otros bodies útiles**

Quitar el botón "Inscribirme" (responde con `"inscripcion_url": null`):

```json
{ "inscripcion_url": null }
```

Volver a "Nacional":

```json
{ "distrito": "" }
```

Reactivar:

```json
{ "isActive": true }
```

**Errores:** las fechas se validan **contra lo ya guardado**. Mover solo `fecha_fin` a antes de la `fecha_inicio` guardada → `400` `"fecha_fin must be after fecha_inicio"`.

---

### `DELETE /actividades/:id`

🔒 **ADMIN** — Desactiva la actividad.

```bash
curl -X DELETE http://localhost:3500/api/actividades/6ad75c33e4515633ec65ee4d \
  -H "Authorization: Bearer TOKEN_ADMIN"
```

**Respuesta `200`**

```json
{ "message": "Actividad 6ad75c33e4515633ec65ee4d deactivated" }
```

---

## Noticias — `/api/noticias`

Noticias y comunicados del sitio.

### Objeto noticia

| Campo | Tipo | Descripción |
|---|---|---|
| `titulo` | texto | Título de la tarjeta |
| `resumen` | texto | Texto corto de la tarjeta |
| `categoria` | texto | `Misiones`, `Comunicado oficial`, `Oración` o `Historia`. Define el ícono del placeholder |
| `contenido` | texto | Texto completo. **Solo viene en el detalle** (`GET /:id`), no en el listado |
| `imagen` | texto | URL. Sin imagen, el sitio muestra el ícono de la categoría |
| `publicado` | booleano | `false` = borrador, no se ve en el sitio |
| `fecha_publicacion` | fecha | La fecha de la tarjeta ("16 de marzo de 2026") |
| `autor` | objeto | `{ "_id", "name", "last_name" }` de quien la creó. Nunca su correo |

Más los [campos que agrega la API](#campos-que-agrega-la-api).

---

### `GET /noticias`

🌐 **Público (el panel ve más)** — Lista paginada, **la más reciente primero**. Los visitantes reciben solo las publicadas. ADMIN y COMUNICACIONES con token también ven los borradores.

**Parámetros**

| Parámetro | Descripción |
|---|---|
| `publicado` | `false` lista los borradores (solo panel). Para el resto se ignora y siempre reciben las publicadas |
| `isActive` | `false` lista las desactivadas, para reactivarlas (solo panel: ADMIN, COMUNICACIONES). Para el resto se ignora |
| `categoria` | Una de las 4 categorías (escrita exacta, con tilde: `Oraci%C3%B3n` en la URL) |
| `search` | Busca en el título |
| `limit`, `offset` | [Paginación](#listados-y-paginación) |

**Ejemplo: el sitio**

```bash
curl http://localhost:3500/api/noticias
```

**Respuesta `200`**

```json
{
  "total": 1,
  "limit": 20,
  "offset": 0,
  "data": [
    {
      "_id": "6ad75c33e4515633ec65ee50",
      "titulo": "Congreso de Misiones 2026 reunió a iglesias de todo el país",
      "resumen": "Tres días de formación en Koyamentu con invitados de Brasil, México y Chile.",
      "categoria": "Misiones",
      "imagen": "https://cdn.iglesia.cl/noticias/congreso-misiones.jpg",
      "publicado": true,
      "fecha_publicacion": "2026-03-16T15:00:00.000Z",
      "autor": { "_id": "6ad75c2fe4515633ec65ee43", "name": "carla", "last_name": "prueba" },
      "isActive": true,
      "created_at": "2026-10-20T12:18:59.405Z",
      "update_at": "2026-10-20T12:18:59.405Z"
    }
  ]
}
```

Fíjate que el listado **no trae `contenido`**: las tarjetas no lo necesitan y así la respuesta pesa mucho menos.

**Ejemplo: el panel revisa los borradores**

```bash
curl "http://localhost:3500/api/noticias?publicado=false" \
  -H "Authorization: Bearer TOKEN_COMUNICACIONES"
```

```json
{
  "total": 1,
  "limit": 20,
  "offset": 0,
  "data": [
    {
      "_id": "6ad75c33e4515633ec65ee51",
      "titulo": "Unánimes a una oración",
      "resumen": "Convocatoria nacional a un tiempo de oración por nuestras iglesias y por Chile.",
      "categoria": "Oración",
      "publicado": false,
      "autor": { "_id": "6ad75c2fe4515633ec65ee43", "name": "carla", "last_name": "prueba" },
      "isActive": true,
      "created_at": "2026-10-20T12:18:59.413Z",
      "update_at": "2026-10-20T12:18:59.413Z"
    }
  ]
}
```

---

### `GET /noticias/:id`

🌐 **Público (el panel ve más)** — Una noticia completa, **con `contenido`**. Un borrador consultado por un visitante responde 404.

```bash
curl http://localhost:3500/api/noticias/6ad75c33e4515633ec65ee50
```

**Respuesta `200`**

```json
{
  "_id": "6ad75c33e4515633ec65ee50",
  "titulo": "Congreso de Misiones 2026 reunió a iglesias de todo el país",
  "resumen": "Tres días de formación en Koyamentu con invitados de Brasil, México y Chile.",
  "categoria": "Misiones",
  "contenido": "Entre el 13 y el 15 de marzo se realizó el Congreso de Misiones...",
  "imagen": "https://cdn.iglesia.cl/noticias/congreso-misiones.jpg",
  "publicado": true,
  "fecha_publicacion": "2026-03-16T15:00:00.000Z",
  "autor": { "_id": "6ad75c2fe4515633ec65ee43", "name": "carla", "last_name": "prueba" },
  "isActive": true,
  "created_at": "2026-10-20T12:18:59.405Z",
  "update_at": "2026-10-20T12:18:59.405Z"
}
```

Borrador consultado sin token → `404`:

```json
{ "message": "Noticia with id 6ad75c33e4515633ec65ee51 not found", "error": "Not Found", "statusCode": 404 }
```

---

### `POST /noticias`

🔒 **COMUNICACIONES** (y ADMIN) — Crea una noticia. **El autor es el usuario del token**: no se envía.

**Body**

| Campo | Tipo | Obligatorio | Reglas |
|---|---|:-:|---|
| `titulo` | texto | ✅ | Máx. 200 |
| `resumen` | texto | ✅ | Máx. 300 |
| `categoria` | texto | ✅ | `Misiones`, `Comunicado oficial`, `Oración` o `Historia` |
| `contenido` | texto | ✅ | Máx. 20.000 |
| `imagen` | texto | | URL válida |
| `publicado` | booleano | | Por defecto `false` (borrador) |
| `fecha_publicacion` | fecha ISO | | Si se publica sin fecha, se usa el momento actual. Sirve para cargar noticias antiguas con su fecha real |

**Ejemplo: noticia publicada con su fecha original**

```bash
curl -X POST http://localhost:3500/api/noticias \
  -H "Authorization: Bearer TOKEN_COMUNICACIONES" \
  -H "Content-Type: application/json" \
  -d '{"titulo":"Congreso de Misiones 2026 reunió a iglesias de todo el país","resumen":"Tres días de formación en Koyamentu con invitados de Brasil, México y Chile.","contenido":"Entre el 13 y el 15 de marzo se realizó el Congreso de Misiones...","categoria":"Misiones","imagen":"https://cdn.iglesia.cl/noticias/congreso-misiones.jpg","publicado":true,"fecha_publicacion":"2026-03-16T12:00:00-03:00"}'
```

**Respuesta `201`**

```json
{
  "titulo": "Congreso de Misiones 2026 reunió a iglesias de todo el país",
  "resumen": "Tres días de formación en Koyamentu con invitados de Brasil, México y Chile.",
  "categoria": "Misiones",
  "contenido": "Entre el 13 y el 15 de marzo se realizó el Congreso de Misiones...",
  "imagen": "https://cdn.iglesia.cl/noticias/congreso-misiones.jpg",
  "publicado": true,
  "fecha_publicacion": "2026-03-16T15:00:00.000Z",
  "autor": { "_id": "6ad75c2fe4515633ec65ee43", "name": "carla", "last_name": "prueba" },
  "isActive": true,
  "_id": "6ad75c33e4515633ec65ee50",
  "created_at": "2026-10-20T12:18:59.405Z",
  "update_at": "2026-10-20T12:18:59.405Z"
}
```

**Ejemplo: borrador** (sin `publicado`; queda sin `fecha_publicacion`)

```json
{
  "titulo": "Unánimes a una oración",
  "resumen": "Convocatoria nacional a un tiempo de oración por nuestras iglesias y por Chile.",
  "contenido": "Invitamos a todas las iglesias...",
  "categoria": "Oración"
}
```

**Errores**

Intentar indicar el autor → `400`:

```json
{ "message": ["property autor should not exist"], "error": "Bad Request", "statusCode": 400 }
```

Categoría que no existe → `400`:

```json
{ "message": ["categoria must be one of the following values: Misiones, Comunicado oficial, Oración, Historia"], "error": "Bad Request", "statusCode": 400 }
```

Con rol DISTRITO o IGLESIA → `403` `"Forbidden"`.

---

### `PATCH /noticias/:id`

🔒 **COMUNICACIONES** (y ADMIN) — Edita, publica o reactiva una noticia. Se envía solo lo que cambia.

**Body:** cualquier campo de [POST](#post-noticias) (todos opcionales), más `isActive`.

**Ejemplo: publicar un borrador**

```bash
curl -X PATCH http://localhost:3500/api/noticias/6ad75c33e4515633ec65ee51 \
  -H "Authorization: Bearer TOKEN_COMUNICACIONES" \
  -H "Content-Type: application/json" \
  -d '{"publicado":true}'
```

**Respuesta `200`**

```json
{
  "titulo": "Unánimes a una oración",
  "resumen": "Convocatoria nacional a un tiempo de oración por nuestras iglesias y por Chile.",
  "categoria": "Oración",
  "contenido": "Invitamos a todas las iglesias...",
  "publicado": true,
  "autor": { "_id": "6ad75c2fe4515633ec65ee43", "name": "carla", "last_name": "prueba" },
  "isActive": true,
  "_id": "6ad75c33e4515633ec65ee51",
  "created_at": "2026-10-20T12:18:59.413Z",
  "update_at": "2026-10-20T12:18:59.448Z",
  "fecha_publicacion": "2026-10-20T12:18:59.448Z"
}
```

Al publicarse por primera vez sin fecha, recibe `fecha_publicacion` = ahora. Si después se despublica (`"publicado": false`), la fecha se conserva.

---

### `DELETE /noticias/:id`

🔒 **ADMIN** — Desactiva la noticia (publicada o borrador).

```bash
curl -X DELETE http://localhost:3500/api/noticias/6ad75c33e4515633ec65ee51 \
  -H "Authorization: Bearer TOKEN_ADMIN"
```

**Respuesta `200`**

```json
{ "message": "Noticia 6ad75c33e4515633ec65ee51 deactivated" }
```

---

## `GET /api`

🌐 **Público** — Responde el texto `Hello World!`. Sirve para comprobar que la API está arriba.

```bash
curl http://localhost:3500/api
```

---

## Resumen de todos los endpoints

| Método | Ruta | Quién | Para qué |
|---|---|---|---|
| GET | `/api` | 🌐 | Comprobar que la API responde |
| POST | `/api/auth/register` | 🌐 | Crear cuenta (rol IGLESIA) |
| POST | `/api/auth/login` | 🌐 | Iniciar sesión: token + menú |
| GET | `/api/auth/me` | 🔑 | Usuario del token |
| GET | `/api/auth` | 🔒 ADMIN | Listar usuarios |
| GET | `/api/auth/:id` | 🔒 ADMIN | Ver usuario |
| PATCH | `/api/auth/:id` | 🔒 ADMIN | Editar usuario, roles, reactivar |
| DELETE | `/api/auth/:id` | 🔒 ADMIN | Desactivar usuario |
| GET | `/api/iglesias` | 🌐 (panel ve más) | Listar iglesias |
| GET | `/api/iglesias/distritos` | 🌐 | Distritos con iglesias |
| GET | `/api/iglesias/:id` | 🌐 (panel ve más) | Ver iglesia |
| POST | `/api/iglesias` | 🔒 DISTRITO ⚠ | Crear iglesia (hoy abierto, ver arriba) |
| PATCH | `/api/iglesias/:id` | 🔒 DISTRITO | Editar / reactivar iglesia |
| DELETE | `/api/iglesias/:id` | 🔒 ADMIN | Desactivar iglesia |
| GET | `/api/actividades` | 🌐 (panel ve más) | Listar actividades |
| GET | `/api/actividades/:id` | 🌐 (panel ve más) | Ver actividad |
| POST | `/api/actividades` | 🔒 COMUNICACIONES, DISTRITO | Crear actividad |
| PATCH | `/api/actividades/:id` | 🔒 COMUNICACIONES, DISTRITO | Editar / reactivar actividad |
| DELETE | `/api/actividades/:id` | 🔒 ADMIN | Desactivar actividad |
| GET | `/api/noticias` | 🌐 (panel ve más) | Listar noticias |
| GET | `/api/noticias/:id` | 🌐 (panel ve más) | Ver noticia completa |
| POST | `/api/noticias` | 🔒 COMUNICACIONES | Crear noticia |
| PATCH | `/api/noticias/:id` | 🔒 COMUNICACIONES | Editar / publicar / reactivar noticia |
| DELETE | `/api/noticias/:id` | 🔒 ADMIN | Desactivar noticia |

ADMIN puede usar todos los 🔒.
