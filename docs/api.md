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
- [Pendientes del proyecto](#por-hacer-auth): [Auth](#por-hacer-auth) · [Iglesias](#por-hacer-iglesias) · [Actividades](#por-hacer-actividades) · [Noticias](#por-hacer-noticias) · [Mensajes](#por-hacer-mensajes) · [Resumen](#por-hacer-resumen-del-panel) · [Correo](#por-hacer-correo) · [General](#por-hacer-general)
- [Mensajes](#mensajes--apimensajes): [enviar (sitio)](#post-mensajes) · [listar](#get-mensajes) · [ver](#get-mensajesid) · [marcar](#patch-mensajesid) · [archivar](#delete-mensajesid)
- [Resumen del panel](#resumen-del-panel--apiresumen): [pantalla completa](#get-resumen) · [por hacer](#get-resumenpor-hacer)
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
| **403** | Login: cuenta bloqueada por intentos fallidos, o usuario IGLESIA sin iglesia activa | `"The user is blocked after too many failed attempts; an ADMIN must unblock it"` |
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
| `pendientes` | Solo iglesias, actividades y noticias. Los datos que le faltan para estar completo, ej. `["reuniones", "email"]`; `[]` = completo. Se calcula al responder (no se guarda ni se envía). Ver [Por hacer del panel](#get-resumenpor-hacer) |

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
| `iglesia` | objeto | `{ "_id", "name", "distrito", "comuna" }` de su iglesia, o `null`. **Necesaria para que un `IGLESIA` haga login** ([regla](#la-iglesia-del-usuario-rol-iglesia)) |
| `isActive` | booleano | `false` = desactivado, no puede entrar |
| `retry` | número | Intentos de login fallidos seguidos. Con 3, la cuenta se bloquea |
| `update_at_login` | fecha | Último login correcto |

La contraseña **nunca** viene en las respuestas.

### La iglesia del usuario (rol IGLESIA)

**Un usuario con el rol `IGLESIA` necesita una iglesia asociada para entrar al panel.** Se puede crear sin ella, pero no puede hacer login hasta que un ADMIN se la asigne:

| Cuándo | Qué pasa |
|---|---|
| **Registro** (`POST /auth/register`) | `iglesia` es opcional. Si viene, debe ser el `_id` de una iglesia activa (elegida de `GET /iglesias`); si no, el usuario queda con `"iglesia": null` |
| **Edición** (`PATCH /auth/:id`, ADMIN) | `{ "iglesia": "<_id>" }` la asigna (se revisa que exista y esté activa); `{ "iglesia": null }` la quita |
| **Login** | Un usuario `IGLESIA` sin iglesia, o cuya iglesia fue desactivada, recibe `403` y no obtiene token, hasta que un ADMIN le asigne una |

Los demás roles pueden tener una iglesia asociada, pero no la necesitan. Login, registro, `GET /auth/me` y la gestión de usuarios devuelven la iglesia con `{ "_id", "name", "distrito", "comuna" }`.

---

### `POST /auth/register`

🌐 **Público** — Crea una cuenta. **Siempre con rol `IGLESIA`**, con o sin iglesia (sin ella no podrá hacer login hasta que un ADMIN se la asigne); los demás roles los asigna un ADMIN. Deja la sesión iniciada (devuelve token).

**Body**

| Campo | Tipo | Obligatorio | Reglas |
|---|---|:-:|---|
| `name` | texto | ✅ | Solo letras (incluye tildes y ñ) y espacios |
| `last_name` | texto | ✅ | Solo letras y espacios |
| `email` | texto | ✅ | Email válido. Único (sin distinguir mayúsculas) |
| `password` | texto | ✅ | Entre 6 y 50 caracteres |
| `iglesia` | texto | — | `_id` de una iglesia **activa**: el formulario de registro la deja elegir de `GET /iglesias`. Si no viene, queda `null` |

**Ejemplo**

```bash
curl -X POST http://localhost:3500/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"José","last_name":"Muñoz","email":"Jose.Munoz@Iglesia.cl","password":"secreto123","iglesia":"6ad75c33e4515633ec65ee46"}'
```

**Respuesta `201`**

```json
{
  "user": {
    "name": "josé",
    "last_name": "muñoz",
    "email": "jose.munoz@iglesia.cl",
    "roles": ["IGLESIA"],
    "iglesia": { "_id": "6ad75c33e4515633ec65ee46", "name": "Iglesia Bautista de Temuco", "distrito": "Araucanía", "comuna": "Temuco" },
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

Sin `iglesia`, o con una que no existe o está desactivada → `400`:

```json
{ "message": ["iglesia must be the _id of an iglesia (from GET /api/iglesias)"], "error": "Bad Request", "statusCode": 400 }
```

```json
{ "message": "The iglesia 64b0000000000000000000ff does not exist or is not active", "error": "Bad Request", "statusCode": 400 }
```

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
    "iglesia": null,
    "isActive": true,
    "retry": 0,
    "created_at": "2026-10-20T12:18:54.879Z",
    "update_at": "2026-10-20T12:18:57.879Z",
    "update_at_login": "2026-10-20T12:18:57.878Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5...",
  "expiresIn": 28800,
  "menu": [
    { "titulo": "Resumen", "icono": "grafico", "ruta": "resumen" },
    { "titulo": "Iglesias", "icono": "templo", "ruta": "iglesias" },
    { "titulo": "Noticias", "icono": "diario", "ruta": "noticias" },
    { "titulo": "Actividades", "icono": "calendario", "ruta": "actividades" },
    { "titulo": "Devocional", "icono": "libro", "ruta": "devocional" },
    { "titulo": "Proyectos", "icono": "semilla", "ruta": "proyectos" },
    { "titulo": "Directiva", "icono": "usuarios", "ruta": "directiva" },
    { "titulo": "Mensajes", "icono": "bandeja", "ruta": "mensajes" },
    { "titulo": "Usuarios y roles", "icono": "llave", "ruta": "usuarios" },
    { "titulo": "Configuración", "icono": "ajustes", "ruta": "configuracion" }
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

Usuario con rol `IGLESIA` sin iglesia asociada, o con su iglesia desactivada (con la contraseña correcta) → `403`. Un ADMIN se la asigna con [`PATCH /auth/:id`](#patch-authid) y `{ "iglesia": "<id>" }`:

```json
{ "message": "Users with the IGLESIA role need an active iglesia; an ADMIN must assign it (PATCH /api/auth/:id { \"iglesia\": \"<id>\" })", "error": "Forbidden", "statusCode": 403 }
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
  "iglesia": { "_id": "6ad75c33e4515633ec65ee46", "name": "Iglesia Bautista de Temuco", "distrito": "Araucanía", "comuna": "Temuco" },
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
| `iglesia` | texto o `null` | `_id` de una iglesia activa: la asigna o la cambia. `null` la quita, solo si el usuario no queda con rol `IGLESIA` |
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
  "iglesia": { "_id": "6ad75c33e4515633ec65ee46", "name": "Iglesia Bautista de Temuco", "distrito": "Araucanía", "comuna": "Temuco" },
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

**Ejemplo: asignar la iglesia** (a un usuario IGLESIA que no puede entrar porque no tenía)

```json
{ "iglesia": "6ad75c33e4515633ec65ee46" }
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

### Por hacer (Auth)

| Prioridad | Qué | Por qué |
|:-:|---|---|
| 🔴 Alta | **Límite de intentos por IP** en `login` y `register` (`@nestjs/throttler`) | El bloqueo es por usuario: no frena a quien prueba una clave común contra muchos correos, ni a quien crea cuentas en masa |
| 🔴 Alta | **Recuperar contraseña** ("olvidé mi contraseña") con un enlace por correo | Hoy solo un ADMIN puede cambiarla. El envío de correos ya está listo ([correo.md](correo.md)) |
| 🟡 Media | **Proteger al último ADMIN**: que no pueda quitarse el rol ni desactivarse | Si lo hace, nadie más puede administrar y hay que arreglarlo en Mongo |
| 🟡 Media | **Cambiar la propia contraseña** (`PATCH /auth/me` con la clave actual y la nueva) | Hoy el usuario depende de un ADMIN para cambiarla |
| 🟡 Media | **Que IGLESIA edite su propia ficha** (y asociar DISTRITO a su distrito) | El usuario IGLESIA ya tiene su iglesia; falta la regla "solo la suya" en `PATCH /iglesias/:id`. Para DISTRITO, falta asociarlo a su distrito (hoy IGLESIA no edita nada) |
| 🟢 Baja | Contraseña mínima de **8** caracteres (hoy 6) | Recomendación actual de seguridad |
| 🟢 Baja | **Paginar y filtrar** `GET /auth` (`?search`, `?roles`, `?isActive=false`) | Hoy devuelve todos los usuarios activos de una vez, y los desactivados solo se ven por id |
| 🟢 Baja | **Avisar por correo** cuando un ADMIN cambia los roles de alguien | Ejemplo ya escrito en [correo.md](correo.md#agregar-un-correo-nuevo) |

---

## Iglesias — `/api/iglesias`

Directorio de iglesias del sitio.

### Objeto iglesia

| Campo | Tipo | Descripción |
|---|---|---|
| `distrito` | texto | Nombre del distrito, de la [lista fija](#get-iglesiasdistritos): `Norte`, `Metropolitano`, `Valle Central`, `Biobío`, `Araucanía`, `Los Ríos` |
| `distrito_id` | texto | Calculado: el `id` del distrito (`"araucania"`), para preseleccionar el selector al editar. `null` si el distrito no está en la lista (dato antiguo) |
| `name` | texto | Nombre. Único dentro del distrito |
| `direccion` | texto | Dirección postal |
| `comuna` | texto | Comuna (ej. "Antofagasta"). La tabla del panel la muestra bajo el nombre |
| `reuniones` | texto | Horarios, texto libre |
| `encargado` | texto | Pastor o encargado |
| `email` | texto | Correo de contacto, en minúsculas |
| `telefono` | texto | Teléfono o WhatsApp, ej. `"+56 9 1234 5678"` |
| `lat`, `lng` | número | Coordenadas para el mapa. Siempre las dos o ninguna |
| `pendientes` | lista | Calculado: cuáles de los 5 datos de una ficha completa faltan (`direccion`, `reuniones`, `encargado`, `email`, `telefono`) |
| `ficha` | objeto | Calculado: columnas **Ficha** y **Estado** de la tabla del panel. `{ "completos": 0, "total": 5, "porcentaje": 0, "completa": false, "estado": "Faltan 5" }`. `estado` es `"Completa"`, `"Falta 1"` o `"Faltan N"` |

Más los [campos que agrega la API](#campos-que-agrega-la-api). Los campos opcionales que no se enviaron no aparecen en la respuesta.

**La tabla de iglesias del panel** sale directo de cada fila de `GET /iglesias`:

| Columna | Campo |
|---|---|
| Iglesia (nombre y, debajo, la comuna) | `name`, `comuna` |
| Distrito | `distrito` |
| Ficha: barra y "0/5" | `ficha.porcentaje`, `ficha.completos` / `ficha.total` |
| Estado: "Faltan 5" / "Completa" | `ficha.estado` (color según `ficha.completa`) |
| ✏️ Editar | `PATCH /iglesias/:id` con el `_id` de la fila |

Filtros útiles para la tabla: `?pendientes=true` (solo incompletas), `?pendientes=false` (solo completas), `?search=antofagasta` (nombre o comuna).

---

### `GET /iglesias`

🌐 **Público (el panel ve más)** — Lista paginada, ordenada por distrito y luego por nombre.

**Parámetros**

| Parámetro | Descripción |
|---|---|
| `distrito` | Distrito exacto: el `id` (`araucania`) o el nombre, sin mayúsculas ni tildes |
| `search` | Busca en el nombre o la comuna |
| `isActive` | `false` lista las desactivadas. **Solo con token de ADMIN, DISTRITO o IGLESIA**; para el resto se ignora y siempre ven las activas |
| `pendientes` | `true` lista solo las fichas incompletas (les falta dirección, horario, pastor, correo o teléfono); `false`, solo las completas. Solo panel, como `isActive` |
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
      "comuna": "Temuco",
      "reuniones": "Domingo 11:00, Miércoles 19:30",
      "encargado": "Pastor Juan Pérez",
      "email": "contacto@iglesiatemuco.cl",
      "telefono": "+56 45 221 3344",
      "lat": -38.7359,
      "lng": -72.5904,
      "isActive": true,
      "created_at": "2026-10-20T12:18:59.287Z",
      "update_at": "2026-10-20T12:18:59.287Z",
      "pendientes": [],
      "ficha": { "completos": 5, "total": 5, "porcentaje": 100, "completa": true, "estado": "Completa" },
      "distrito_id": "araucania"
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

🌐 **Público** — **La lista fija de distritos**, de norte a sur, con cuántas iglesias activas tiene cada uno.
Cada distrito tiene **la misma forma que la lista del front**: `{ id, nombre, zona }`, más `total`.

| Campo | Qué es | Uso |
|---|---|---|
| `id` | `"araucania"`: sin tildes ni espacios | El `value` del selector; es lo que se envía al crear o editar |
| `nombre` | `"Araucanía"` | Lo que se muestra; es lo que queda guardado en la iglesia |
| `zona` | `"Temuco, Malleco y Cautín"` | Texto de ayuda bajo el nombre |
| `total` | Iglesias activas del distrito | El sitio puede ocultar los de `0` |

- **Panel:** llena el selector "Distrito" del formulario "Agregar iglesia" (`value` = `id`, texto = `nombre`).
- **Sitio:** el filtro de distritos: `GET /iglesias?distrito=<id>`.

La lista vive en `src/iglesias/distritos.ts` (la misma del front: si se cambia en uno, hay que cambiarla en el otro, o que el front la pida aquí). Si en la base quedó alguna iglesia con un distrito que no está en la lista (cargada antes de que existiera), aparece al final con `id` y `zona` en `null`.

```bash
curl http://localhost:3500/api/iglesias/distritos
```

**Respuesta `200`**

```json
[
  { "id": "norte", "nombre": "Norte", "zona": "Antofagasta y La Serena", "total": 1 },
  { "id": "metropolitano", "nombre": "Metropolitano", "zona": "Santiago, San Antonio y Rancagua", "total": 0 },
  { "id": "valle-central", "nombre": "Valle Central", "zona": "Curicó, Talca, Linares y Ñuble", "total": 1 },
  { "id": "biobio", "nombre": "Biobío", "zona": "Concepción, Arauco y Los Ángeles", "total": 0 },
  { "id": "araucania", "nombre": "Araucanía", "zona": "Temuco, Malleco y Cautín", "total": 1 },
  { "id": "los-rios", "nombre": "Los Ríos", "zona": "Panguipulli, Lanco y Paillaco", "total": 0 }
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
| `distrito` | texto | ✅ | **Uno de la lista fija**: el `id` del selector (`norte`, `metropolitano`, `valle-central`, `biobio`, `araucania`, `los-rios`) o el nombre (`Araucanía`, sin distinguir mayúsculas). Se guarda el nombre. El panel la obtiene de [`GET /iglesias/distritos`](#get-iglesiasdistritos) |
| `name` | texto | ✅ | Máx. 150. **Único dentro del distrito** (sin distinguir mayúsculas ni espacios extra) |
| `direccion` | texto | | Máx. 250 |
| `comuna` | texto | | Máx. 100 |
| `reuniones` | texto | | Máx. 250 |
| `encargado` | texto | | Máx. 150 |
| `email` | texto | | Email válido. Se guarda en minúsculas |
| `telefono` | texto | | 7 a 20 caracteres: dígitos, espacios, `()`, `-` y un `+` inicial. Ej. `"+56 9 1234 5678"` |
| `lat` | número | | Entre -90 y 90. **Junto con `lng`** |
| `lng` | número | | Entre -180 y 180. **Junto con `lat`** |

**El formulario "Agregar iglesia" del panel** usa exactamente estos campos:

| En el formulario | Campo |
|---|---|
| Nombre | `name` |
| Comuna | `comuna` |
| Distrito (selector) | `distrito` |
| Dirección | `direccion` |
| Horario de reuniones | `reuniones` |
| Pastor o encargado | `encargado` |
| Correo de la iglesia | `email` |
| Teléfono | `telefono` |
| Ubicación en el mapa / Latitud / Longitud | `lat`, `lng` (el punto del mapa; se envían las dos o ninguna) |

"Guardar cambios" al editar es un `PATCH /iglesias/:id` con los mismos campos (solo los que cambiaron).

Los espacios repetidos o en los extremos de `distrito`, `name`, `direccion`, `comuna`, `encargado` y `telefono` se eliminan antes de guardar. `lat` y `lng` también se aceptan como texto numérico (`"-38.73"`), pero lo correcto es enviarlos como número.

**Ejemplo**

```bash
curl -X POST http://localhost:3500/api/iglesias \
  -H "Authorization: Bearer TOKEN_DISTRITO" \
  -H "Content-Type: application/json" \
  -d '{"name":"Iglesia Bautista de Temuco","comuna":"Temuco","distrito":"Araucanía","direccion":"Av. Alemania 0450, Temuco","reuniones":"Domingo 11:00, Miércoles 19:30","encargado":"Pastor Juan Pérez","email":"Contacto@IglesiaTemuco.cl","telefono":"+56 45 221 3344","lat":-38.7359,"lng":-72.5904}'
```

**Respuesta `201`**

```json
{
  "distrito": "Araucanía",
  "name": "Iglesia Bautista de Temuco",
  "direccion": "Av. Alemania 0450, Temuco",
  "comuna": "Temuco",
  "reuniones": "Domingo 11:00, Miércoles 19:30",
  "encargado": "Pastor Juan Pérez",
  "email": "contacto@iglesiatemuco.cl",
  "telefono": "+56 45 221 3344",
  "lat": -38.7359,
  "lng": -72.5904,
  "isActive": true,
  "_id": "6ad75c33e4515633ec65ee46",
  "created_at": "2026-10-20T12:18:59.287Z",
  "update_at": "2026-10-20T12:18:59.287Z",
  "pendientes": [],
  "ficha": { "completos": 5, "total": 5, "porcentaje": 100, "completa": true, "estado": "Completa" },
  "distrito_id": "araucania"
}
```

Body mínimo:

```json
{ "distrito": "Araucanía", "name": "Iglesia Bautista de Angol" }
```

**Errores**

Distrito que no está en la lista (ni como `id` ni como nombre, ej. `"atacama"`) → `400`:

```json
{ "message": ["distrito must be one of: norte, metropolitano, valle-central, biobio, araucania, los-rios"], "error": "Bad Request", "statusCode": 400 }
```

Nombre repetido en el distrito. Este body choca con la de Temuco, aunque cambie mayúsculas y espacios: `{"distrito":"Araucanía","name":"  IGLESIA   BAUTISTA DE TEMUCO "}` → `400`:

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

### Por hacer (Iglesias)

| Prioridad | Qué | Por qué |
|:-:|---|---|
| 🔴 Alta | **Volver a proteger `POST /iglesias`** con `@Roles(...MENU.iglesias.editan)` y quitar `@OptionalAuth()` | Hoy cualquiera, sin login, puede crear iglesias en el directorio público |
| 🟡 Media | **DISTRITO edita solo las iglesias de su distrito** | Hoy un DISTRITO puede editar las de cualquier distrito (requiere asociar usuario y distrito, ver Auth) |
| 🟢 Baja | Que el nombre único **ignore también las tildes** ("Concepción" = "Concepcion") | Hoy solo ignora mayúsculas (`strength: 2`); con `strength: 1` ignoraría ambas |
| 🟢 Baja | **Buscar por cercanía** (`?cerca=lat,lng`) con un índice geoespacial | Para "iglesias cerca de mí" en el mapa del sitio |
| 🟢 Baja | Foto de la iglesia | Campo habitual en un directorio |

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
| `inscritos` | número | Personas inscritas, cargadas desde el panel. El Resumen suma las de las próximas actividades |
| `pendientes` | lista | Calculado: cuáles de `descripcion`, `lugar` faltan |

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
| `pendientes` | `true` lista solo las que no tienen descripción o lugar; `false`, solo las completas (solo panel). Junto con `desde=hoy`, las próximas por completar |
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
      "update_at": "2026-10-20T12:18:59.364Z",
      "pendientes": []
    },
    {
      "_id": "6ad75c33e4515633ec65ee4f",
      "titulo": "Culto unido de Reforma",
      "fecha_inicio": "2026-10-31T22:00:00.000Z",
      "lugar": "Santiago",
      "distrito": "Metropolitano",
      "isActive": true,
      "created_at": "2026-10-20T12:18:59.371Z",
      "update_at": "2026-10-20T12:18:59.371Z",
      "pendientes": ["descripcion"]
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
      "update_at": "2026-10-20T12:18:59.367Z",
      "pendientes": []
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
| `inscritos` | número | | Entero, 0 o más |

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
  "update_at": "2026-10-20T12:18:59.364Z",
  "pendientes": []
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

### Por hacer (Actividades)

| Prioridad | Qué | Por qué |
|:-:|---|---|
| 🟡 Media | **DISTRITO crea y edita solo actividades de su distrito** (o nacionales solo COMUNICACIONES) | Hoy un DISTRITO puede crear actividades de cualquier distrito |
| 🟡 Media | **Zona horaria real** (`America/Santiago` con `Intl` o una librería) en `?desde` / `?hasta` | Hoy se usan UTC-3 y UTC-4 fijos: el rango puede incluir una hora del día vecino |
| 🟢 Baja | **Imagen** de la actividad | Las tarjetas del sitio quedarían más vistosas |
| 🟢 Baja | **Inscripción propia** (formulario y lista de inscritos) en vez de solo un enlace externo | Hoy `inscripcion_url` apunta a un formulario fuera de la API y `inscritos` se carga a mano |
| 🟢 Baja | Exportar a **calendario** (`GET /actividades/:id.ics`) | Hoy el front arma el enlace de Google Calendar ([guía](guia-de-uso.md#agregar-a-google-calendar)) |

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
| `pendientes` | lista | Calculado: `["imagen"]` si no tiene imagen |

Más los [campos que agrega la API](#campos-que-agrega-la-api).

---

### `GET /noticias`

🌐 **Público (el panel ve más)** — Lista paginada, **la más reciente primero**. Los visitantes reciben solo las publicadas. ADMIN y COMUNICACIONES con token también ven los borradores.

**Parámetros**

| Parámetro | Descripción |
|---|---|
| `publicado` | `false` lista los borradores (solo panel). Para el resto se ignora y siempre reciben las publicadas |
| `isActive` | `false` lista las desactivadas, para reactivarlas (solo panel: ADMIN, COMUNICACIONES). Para el resto se ignora |
| `pendientes` | `true` lista solo las que no tienen imagen; `false`, solo las que sí (solo panel) |
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
      "update_at": "2026-10-20T12:18:59.405Z",
      "pendientes": []
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
      "update_at": "2026-10-20T12:18:59.413Z",
      "pendientes": ["imagen"]
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
  "update_at": "2026-10-20T12:18:59.405Z",
  "pendientes": []
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
  "update_at": "2026-10-20T12:18:59.405Z",
  "pendientes": []
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
  "pendientes": ["imagen"]
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

### Por hacer (Noticias)

| Prioridad | Qué | Por qué |
|:-:|---|---|
| 🔴 Alta | **Definir el formato de `contenido`** (texto, Markdown o HTML) y, si es HTML, **sanitizarlo** al guardar | Si el front lo muestra como HTML sin limpiar, alguien con acceso al panel podría inyectar scripts en el sitio |
| 🟡 Media | **Subir la imagen** a la API (o a un almacenamiento) en vez de pedir una URL | Hoy hay que alojarla en otro lado y pegar el enlace |
| 🟡 Media | **Slug** para URLs amigables (`/noticias/aniversario-iglesia-central`) | Mejor para compartir y para buscadores |
| 🟢 Baja | Registrar **quién editó** por última vez, además del autor | Hoy solo se sabe quién la creó |
| 🟢 Baja | **Publicación programada** (`fecha_publicacion` futura que se publique sola) | Hoy hay que publicarla a mano en el momento |

### Por hacer (Resumen del panel)

La pantalla [Resumen](#get-resumen) ya entrega las 4 tarjetas, el "Por hacer" (fichas, actividades, mensajes, borradores), los accesos rápidos, la actividad reciente y el avance por distrito. Lo que falta del diseño:

| Prioridad | Qué | Por qué |
|:-:|---|---|
| 🟡 Media | **Cambios por aprobar** ("Revisar cambio de Oasis de Esperanza · Traiguén" + botón **Aprobar**) | Requiere que una iglesia proponga cambios a su ficha y un DISTRITO los apruebe: hoy los cambios se guardan directo |
| 🟡 Media | **Módulo Devocional** ("Escribir 3 reflexiones para los próximos días sin texto") | Está en el menú y en los accesos rápidos, pero no tiene API |
| 🟡 Media | **Módulo Proyectos** (acceso "Actualizar proyectos") | Igual: está en el menú, sin API |
| 🟢 Baja | Usar la lista fija de distritos también en **actividades** (más `"Nacional"`) | Hoy en actividades el distrito sigue siendo texto libre |
| 🟢 Baja | **Inscripciones reales** en vez de cargar `inscritos` a mano | La inscripción hoy es un formulario externo (`inscripcion_url`) que la API no ve |
| 🟢 Baja | Eventos que no son cambios de datos en "Actividad reciente" ("Comunicaciones activó la transmisión en vivo") | Necesita la sección Configuración con su API |
| 🟢 Baja | Mostrar el **rol o distrito** en "Actividad reciente" ("Distrito Araucanía actualizó...") | Hoy muestra el nombre de la persona; el distrito requiere asociarlo al usuario (ver Auth) |
| 🟢 Baja | Que cada IGLESIA vea los pendientes de **su** iglesia | El usuario ya tiene su iglesia; falta filtrar el Resumen por ella |
| 🟢 Baja | Borrar el historial antiguo (índice TTL, ej. 1 año) | La colección `historial` crece con cada cambio |

Cada tarea nueva del "Por hacer" se suma con un método en `ResumenService`, sin cambiar la forma de la respuesta.

### Por hacer (Correo)

| Prioridad | Qué | Por qué |
|:-:|---|---|
| 🟡 Media | **Cola de envío** persistente (ej. BullMQ con Redis) | Hoy los reintentos viven en memoria: si la app se reinicia a mitad de un reintento, el correo se pierde |
| 🟢 Baja | **Logo real** de la iglesia en el encabezado | Hoy es una cruz ✝ en un círculo |
| 🟢 Baja | Más correos: recuperar contraseña, roles actualizados, cuenta desbloqueada | Ver [correo.md](correo.md#agregar-un-correo-nuevo) |

### Por hacer (General)

| Prioridad | Qué | Por qué |
|:-:|---|---|
| 🔴 Alta | **Definir `CORS_ORIGINS`** en producción | Sin él, cualquier sitio puede llamar a la API desde el navegador de un usuario |
| 🟡 Media | **Documentación interactiva** con Swagger (`@nestjs/swagger`) en `/api/docs` | Probar los endpoints desde el navegador, generada desde los DTO |
| 🟡 Media | **Tests e2e reales** (`test/app.e2e-spec.ts` es el del generador y apunta a `/` en vez de `/api`) | Probar los flujos completos con una base de prueba |
| 🟢 Baja | `GET /api` que revise también la conexión a Mongo (`@nestjs/terminus`) | Para que el hosting sepa si la API está sana de verdad |

---

## Mensajes — `/api/mensajes`

Mensajes del **formulario de contacto del sitio**. El sitio los envía sin login; el panel los lee y los marca como leídos.

### Objeto mensaje

| Campo | Tipo | Descripción |
|---|---|---|
| `nombre` | texto | Quién escribe |
| `email` | texto | Para responderle, en minúsculas |
| `telefono` | texto | Opcional |
| `asunto` | texto | Opcional |
| `mensaje` | texto | El mensaje |
| `leido` | booleano | `false` = sin leer: cuenta en la tarjeta "Mensajes sin leer" y en el "Por hacer" |
| `isActive` | booleano | `false` = archivado |
| `created_at` | fecha | Cuándo llegó |

### `POST /mensajes`

🌐 **Público** — El formulario de contacto. Responde solo una confirmación (el visitante no recibe el registro guardado).

| Campo | Tipo | Obligatorio | Reglas |
|---|---|:-:|---|
| `nombre` | texto | ✅ | Máx. 100 |
| `email` | texto | ✅ | Email válido |
| `telefono` | texto | | Mismo formato que el de las iglesias |
| `asunto` | texto | | Máx. 150 |
| `mensaje` | texto | ✅ | Máx. 2000 |

```bash
curl -X POST http://localhost:3500/api/mensajes \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Rosa","email":"rosa@correo.cl","mensaje":"¿A qué hora es el culto?"}'
```

**Respuesta `201`**

```json
{ "message": "Mensaje recibido" }
```

### `GET /mensajes`

🔒 **ADMIN, COMUNICACIONES, DISTRITO, IGLESIA** (los que ven "Mensajes" en el menú) — Lista paginada, el más nuevo primero.

| Parámetro | Descripción |
|---|---|
| `leido` | `false` = solo los sin leer; `true` = solo los leídos. Sin enviar: todos |
| `isActive` | `false` lista los archivados |
| `search` | Busca en nombre, correo y asunto |
| `limit`, `offset` | [Paginación](#listados-y-paginación) |

### `GET /mensajes/:id`

🔒 Mismos roles — Un mensaje (también archivado).

### `PATCH /mensajes/:id`

🔒 Mismos roles — Solo cambia el estado; lo que escribió el visitante no se edita.

```json
{ "leido": true }
```

| Campo | Tipo | Reglas |
|---|---|---|
| `leido` | booleano | `true` lo marca como leído; `false`, como nuevo otra vez |
| `isActive` | booleano | `true` recupera uno archivado |

### `DELETE /mensajes/:id`

🔒 **ADMIN** — Archiva el mensaje (borrado lógico). Responde `{ "message": "Mensaje <id> archived" }`.

### Por hacer (Mensajes)

| Prioridad | Qué | Por qué |
|:-:|---|---|
| 🔴 Alta | **Límite de envíos por IP** en `POST /mensajes` (`@nestjs/throttler`) y un captcha en el sitio | Es público: sin límite, un bot puede llenar la bandeja |
| 🟡 Media | **Responder desde el panel** (envía el correo y marca `respondido`) | Hoy se responde desde el correo propio; el panel solo marca leído |
| 🟢 Baja | **Avisar por correo** al equipo cuando llega un mensaje | Con [@nestjs/mail](correo.md#agregar-un-correo-nuevo) ya configurado |
| 🟢 Baja | Dirigir el mensaje a una iglesia o distrito | Hoy todos los mensajes los ven todos los roles del panel |

---

## Resumen del panel — `/api/resumen`

### `GET /resumen`

🔑 **Cualquier usuario con sesión** — **Toda la pantalla Resumen en un solo request**: las 4 tarjetas de números, el "Por hacer", los accesos rápidos, la actividad reciente y el avance de fichas por distrito.

**Cada bloque depende del rol:** lo que el usuario no ve en el menú llega como `null` (el front lo oculta); el "Por hacer" y los accesos rápidos solo incluyen lo que puede hacer.

```bash
curl http://localhost:3500/api/resumen \
  -H "Authorization: Bearer TOKEN"
```

**Respuesta `200`** (ADMIN; basada en una prueba con 3 iglesias, 3 actividades, 2 noticias y 5 mensajes; `actividadReciente` recortada a 3 líneas)

```json
{
  "tarjetas": {
    "fichas": { "completas": 1, "total": 3, "porcentaje": 33, "detalle": "Con dirección, horario, pastor, correo y teléfono" },
    "mensajes": { "total": 5, "sinLeer": 4 },
    "actividades": { "proximas": 2, "inscritos": 105 },
    "noticias": { "publicadas": 1, "borradores": 1 }
  },
  "porHacer": {
    "total": 4,
    "items": [
      { "tipo": "completar-iglesias", "seccion": "iglesias", "icono": "templo", "titulo": "Completar 2 fichas de iglesia", "detalle": "Dirección, horario, pastor, correo y teléfono ayudan a que las visiten", "cantidad": 2, "ruta": "iglesias?pendientes=true" },
      { "tipo": "completar-actividades", "seccion": "actividades", "icono": "calendario", "titulo": "Completar 1 actividad próxima", "detalle": "Descripción y lugar ayudan a que se sumen más personas", "cantidad": 1, "ruta": "actividades?pendientes=true&desde=2026-10-20" },
      { "tipo": "responder-mensajes", "seccion": "mensajes", "icono": "bandeja", "titulo": "Responder 4 mensajes", "detalle": "Recibidos desde el sitio", "cantidad": 4, "ruta": "mensajes?leido=false" },
      { "tipo": "terminar-borrador", "seccion": "noticias", "icono": "diario", "titulo": "Terminar el borrador de noticia", "detalle": "Resultados del retiro de jóvenes", "cantidad": 1, "ruta": "noticias/6ad81450c25c93352704b579", "id": "6ad81450c25c93352704b579" }
    ]
  },
  "accesosRapidos": [
    { "titulo": "Publicar noticia", "icono": "diario", "ruta": "noticias/nueva" },
    { "titulo": "Crear actividad", "icono": "calendario", "ruta": "actividades/nueva" },
    { "titulo": "Actualizar proyectos", "icono": "semilla", "ruta": "proyectos" },
    { "titulo": "Programar devocional", "icono": "libro", "ruta": "devocional" }
  ],
  "actividadReciente": [
    { "fecha": "2026-10-21T01:24:32.621Z", "texto": "Carla Diaz creó el borrador “Resultados del retiro de jóvenes”", "accion": "crear", "seccion": "noticias", "registro": "6ad81450c25c93352704b579", "titulo": "Resultados del retiro de jóvenes" },
    { "fecha": "2026-10-21T01:24:32.583Z", "texto": "Carla Diaz publicó la noticia “Unánimes a una oración”", "accion": "publicar", "seccion": "noticias", "registro": "6ad81450c25c93352704b577", "titulo": "Unánimes a una oración" },
    { "fecha": "2026-10-21T01:24:32.534Z", "texto": "Pedro Soto actualizó la ficha de Oasis", "accion": "editar", "seccion": "iglesias", "registro": "6ad81450c25c93352704b56f", "titulo": "Oasis" }
  ],
  "avanceDistritos": {
    "detalle": "Cada ficha completa tiene 5 datos: dirección, horario, pastor, correo y teléfono.",
    "distritos": [
      { "id": "norte", "nombre": "Norte", "zona": "Antofagasta y La Serena", "iglesias": 0, "porcentaje": 0 },
      { "id": "metropolitano", "nombre": "Metropolitano", "zona": "Santiago, San Antonio y Rancagua", "iglesias": 0, "porcentaje": 0 },
      { "id": "valle-central", "nombre": "Valle Central", "zona": "Curicó, Talca, Linares y Ñuble", "iglesias": 2, "porcentaje": 80 },
      { "id": "biobio", "nombre": "Biobío", "zona": "Concepción, Arauco y Los Ángeles", "iglesias": 0, "porcentaje": 0 },
      { "id": "araucania", "nombre": "Araucanía", "zona": "Temuco, Malleco y Cautín", "iglesias": 1, "porcentaje": 0 },
      { "id": "los-rios", "nombre": "Los Ríos", "zona": "Panguipulli, Lanco y Paillaco", "iglesias": 0, "porcentaje": 0 }
    ]
  }
}
```

**Cada bloque, en la pantalla del diseño:**

| Bloque | En pantalla | Cómo se calcula | Lo ven |
|---|---|---|---|
| `tarjetas.fichas` | "Fichas completas · **0** de 48" y su barra | Iglesias activas con los 5 datos (`completas`) sobre el total. `porcentaje` = completas / total | Quien ve Iglesias |
| `tarjetas.mensajes` | "Mensajes sin leer · **3** · 4 en total" | Mensajes no archivados; `sinLeer` = `leido: false` | Quien ve Mensajes |
| `tarjetas.actividades` | "Próximas actividades · **6** · 105 personas inscritas" | Actividades activas por venir o en curso, y la suma de su campo `inscritos` | Quien ve Actividades |
| `tarjetas.noticias` | "Noticias publicadas · **4** · 1 en borrador" | Noticias activas publicadas / en borrador | Quien ve Noticias |
| `porHacer` | Recuadro "Por hacer" | Igual que [`GET /resumen/por-hacer`](#get-resumenpor-hacer) | Según lo que puede editar |
| `accesosRapidos` | "Publicar noticia", "Crear actividad"... | `ACCESOS_RAPIDOS` en `menu.config.ts`: con API, quien puede editar; sin API (proyectos, devocional), quien ve la sección | Según el rol |
| `actividadReciente` | "20 oct · Distrito Araucanía actualizó la ficha de..." | Los 5 últimos cambios del historial, de las secciones que ve. `fecha` en UTC: mostrarla con `timeZone: 'America/Santiago'` | Según las secciones que ve |
| `avanceDistritos` | "Avance de fichas por distrito" | Todos los distritos de la lista fija, **de norte a sur** (los sin iglesias, en 0), con `id`, `nombre` y `zona` como en `GET /iglesias/distritos`. Por distrito: datos llenos / datos posibles. Ej. 5 iglesias × 5 datos = 25; con 3 llenos, **12%**. Así una ficha a medias también suma | Quien ve Iglesias |

`ruta` (en `porHacer` y `accesosRapidos`) es la `ruta` de la sección en el menú, con filtros (`?pendientes=true`) o `/nueva` para el formulario de crear.

### `GET /resumen/por-hacer`

🔑 **Cualquier usuario con sesión** — Solo el recuadro **Por hacer** (para refrescarlo sin pedir toda la pantalla). **Cada usuario recibe solo lo que su rol puede resolver**: si la API le respondería 403 al intentarlo, la tarea no aparece.

| Tarea | Para quién | Cuándo aparece |
|---|---|---|
| `completar-iglesias` | DISTRITO, ADMIN | Hay iglesias activas a las que les falta dirección, horario, pastor, correo o teléfono |
| `completar-actividades` | COMUNICACIONES, DISTRITO, ADMIN | Hay actividades por venir o en curso sin descripción o lugar (las pasadas no cuentan) |
| `responder-mensajes` | COMUNICACIONES, DISTRITO, IGLESIA, ADMIN | Hay mensajes del sitio sin leer |
| `terminar-borrador` | COMUNICACIONES, ADMIN | Una tarjeta por borrador de noticia, los 3 últimos editados |
| `revisar-borradores` | COMUNICACIONES, ADMIN | Si hay más de 3 borradores, una tarjeta con el resto |

IGLESIA solo recibe `responder-mensajes` (es lo único que puede resolver hoy). Quién edita cada sección sale de `editan` en `menu.config.ts` (la misma lista que usan los `@Roles` de POST/PATCH).

```bash
curl http://localhost:3500/api/resumen/por-hacer \
  -H "Authorization: Bearer TOKEN"
```

**Respuesta `200`** (ADMIN; basada en una prueba real, con 2 iglesias incompletas, 1 actividad y 5 borradores)

```json
{
  "total": 6,
  "items": [
    {
      "tipo": "completar-iglesias",
      "seccion": "iglesias",
      "icono": "templo",
      "titulo": "Completar 2 fichas de iglesia",
      "detalle": "Dirección, horario, pastor, correo y teléfono ayudan a que las visiten",
      "cantidad": 2,
      "ruta": "iglesias?pendientes=true"
    },
    {
      "tipo": "completar-actividades",
      "seccion": "actividades",
      "icono": "calendario",
      "titulo": "Completar 1 actividad próxima",
      "detalle": "Descripción y lugar ayudan a que se sumen más personas",
      "cantidad": 1,
      "ruta": "actividades?pendientes=true&desde=2026-10-20"
    },
    {
      "tipo": "terminar-borrador",
      "seccion": "noticias",
      "icono": "diario",
      "titulo": "Terminar el borrador de noticia",
      "detalle": "Resultados del retiro de jóvenes",
      "cantidad": 1,
      "ruta": "noticias/6ad80fe6e39aac29a61ce09e",
      "id": "6ad80fe6e39aac29a61ce09e"
    },
    { "tipo": "terminar-borrador", "...": "uno por borrador, hasta 3" },
    {
      "tipo": "revisar-borradores",
      "seccion": "noticias",
      "icono": "diario",
      "titulo": "Revisar 2 borradores más",
      "detalle": "Noticias sin publicar",
      "cantidad": 2,
      "ruta": "noticias?publicado=false"
    }
  ]
}
```

| Campo | Qué es |
|---|---|
| `total` | Cantidad de tarjetas: el número del recuadro |
| `tipo` | Tipo de tarea (tabla de arriba) |
| `seccion` / `icono` | Sección del menú y su ícono (el mismo del menú) |
| `titulo` / `detalle` | Las dos líneas de la tarjeta |
| `cantidad` | A cuántos registros se refiere |
| `ruta` | Adónde lleva el botón **Ir**: la `ruta` de la sección en el menú, con los mismos filtros que acepta la API. Por ejemplo `iglesias?pendientes=true` → el panel abre su lista de iglesias y llama a `GET /api/iglesias?pendientes=true` |
| `id` | Solo en `terminar-borrador`: el id de la noticia |

Una sección sin nada pendiente no genera tarjeta. Sin token → `401`.

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
| POST | `/api/mensajes` | 🌐 | Formulario de contacto del sitio |
| GET | `/api/mensajes` | 🔒 roles del menú Mensajes | Listar mensajes |
| GET | `/api/mensajes/:id` | 🔒 roles del menú Mensajes | Ver mensaje |
| PATCH | `/api/mensajes/:id` | 🔒 roles del menú Mensajes | Marcar leído / recuperar |
| DELETE | `/api/mensajes/:id` | 🔒 ADMIN | Archivar mensaje |
| GET | `/api/resumen` | 🔑 | Toda la pantalla Resumen del panel, según el rol |
| GET | `/api/resumen/por-hacer` | 🔑 | Solo el recuadro "Por hacer" |

ADMIN puede usar todos los 🔒.
