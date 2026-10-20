# Guía de uso

Cómo usar la API paso a paso: probarla, dejarla lista la primera vez, y consumirla desde el panel y desde el sitio web. Cada endpoint en detalle está en [api.md](api.md).

## Índice

1. [Probar la API](#probar-la-api)
2. [Primera vez: dejar todo listo](#primera-vez-dejar-todo-listo)
3. [El panel administrativo](#el-panel-administrativo)
4. [El sitio web público](#el-sitio-web-público)
5. [Código para el frontend](#código-para-el-frontend)
6. [Recetas: tareas frecuentes](#recetas-tareas-frecuentes)
7. [Problemas comunes](#problemas-comunes)

---

## Probar la API

Con la API corriendo (`yarn start:dev`), hay tres formas de probarla sin escribir código.

### Postman
1. En Postman: **Import** → elige [`docs/iglesia.postman_collection.json`](iglesia.postman_collection.json).
2. Abre la colección → pestaña **Variables** → revisa `baseUrl` (`http://localhost:3500/api`) y pon tu correo y contraseña en `email` y `password`.
3. Ejecuta **Auth → Login**. El token queda guardado solo en la variable `token` y lo usan todos los demás requests.
4. Al crear una iglesia, actividad o noticia, su `_id` también se guarda (`iglesiaId`, `actividadId`, `noticiaId`), así que "Ver", "Editar" y "Desactivar" funcionan sin copiar ids.

### VS Code
1. Instala la extensión **REST Client** (de Huachao Mao).
2. Abre [`docs/requests.http`](requests.http).
3. Cambia `@email` y `@password` arriba del archivo.
4. Haz clic en **Send Request** sobre "Login". El token se reutiliza en los demás requests del archivo.

### Terminal
Cada endpoint de [api.md](api.md) tiene su ejemplo con `curl`. Reemplaza `TU_TOKEN` por el `accessToken` del login.

---

## Primera vez: dejar todo listo

### 1. Levantar la base y la API
Sigue la [puesta en marcha del README](../README.md#puesta-en-marcha): `.env`, `docker compose up -d`, `yarn install`, `yarn start:dev`.

Comprueba que responde:

```bash
curl http://localhost:3500/api
```

Debe responder `Hello World!`.

### 2. Crear tu cuenta

```bash
curl -X POST http://localhost:3500/api/auth/register -H "Content-Type: application/json" -d '{"name":"Ana","last_name":"Rojas","email":"ana@iglesia.cl","password":"una-clave-segura"}'
```

Queda con rol `IGLESIA`.

### 3. Convertirla en ADMIN
El registro nunca da el rol ADMIN (si lo diera, cualquiera podría darse ese rol). El primero se asigna directamente en Mongo:

```bash
docker exec IGLESIA_CONTAINER mongosh iglesia --eval 'db.users.updateOne({email:"ana@iglesia.cl"},{$set:{roles:["ADMIN"]}})'
```

### 4. Asignar roles al equipo
Cada persona se registra sola, y luego el ADMIN le asigna su rol:

```bash
curl -X PATCH http://localhost:3500/api/auth/ID_DEL_USUARIO -H "Authorization: Bearer TOKEN_ADMIN" -H "Content-Type: application/json" -d '{"roles":["COMUNICACIONES"]}'
```

El id se obtiene con `GET /api/auth`. El cambio aplica en el siguiente request de esa persona; el menú nuevo lo ve en su próximo login.

| Persona | Rol a asignar |
|---|---|
| Equipo de comunicaciones | `COMUNICACIONES` |
| Encargado de distrito | `DISTRITO` |
| Encargado de una iglesia | `IGLESIA` (ya lo tiene al registrarse) |
| Administración | `ADMIN` |

Una persona puede tener varios: `["DISTRITO", "COMUNICACIONES"]`.

---

## El panel administrativo

### Iniciar sesión

```
POST /api/auth/login   { "email": "...", "password": "..." }
```

La respuesta trae tres cosas que el panel debe guardar:

| Campo | Para qué |
|---|---|
| `accessToken` | Enviarlo en cada request: `Authorization: Bearer <accessToken>` |
| `expiresIn` | Segundos que dura el token (28800 = 8 h). Después hay que volver a hacer login |
| `menu` | Las secciones a mostrar en la barra lateral, ya filtradas por el rol |
| `user` | Nombre, correo y roles, para mostrar "Hola, Ana" |

**El menú ya viene filtrado:** el panel no necesita saber qué rol ve qué; solo dibuja lo que llega. Y si alguien intenta entrar a una sección que no está en su menú, la API responde 403 igual.

### Al recargar la página
Si el panel guardó el token (por ejemplo en `localStorage`), puede recuperar el usuario con:

```
GET /api/auth/me     Authorization: Bearer <token>
```

- `200`: sesión válida, sigue.
- `401`: el token venció o el usuario fue desactivado → mandar al login.

`/auth/me` no devuelve el menú, así que conviene guardarlo junto al token al hacer login.

### Qué responde la API según el caso

| Respuesta | Qué hacer en el panel |
|---|---|
| `401` | Borrar el token y mandar al login (venció, o el usuario fue desactivado) |
| `403` | Mostrar "No tienes permiso para esta acción" |
| `400` con `message` lista | Mostrar cada mensaje junto a su campo del formulario |
| `400` con `message` texto | Mostrar el mensaje (duplicado, fechas, coordenadas) |
| `404` | "No encontrado"; recargar la lista |

### Lo que cada rol hace en el panel

**COMUNICACIONES**
- Noticias: crear (como borrador o publicada), editar, publicar.
- Actividades: crear y editar.

**DISTRITO**
- Iglesias: crear y editar, ver y reactivar las desactivadas.
- Actividades: crear y editar.

**IGLESIA**
- Consulta iglesias y actividades (incluidas las desactivadas). No edita.

**ADMIN**
- Todo lo anterior, más desactivar (DELETE) en cualquier sección y gestionar usuarios.

### Ver lo desactivado y los borradores
Los mismos `GET` del sitio, con token, aceptan:

| Sección | Para ver lo oculto |
|---|---|
| Iglesias | `GET /api/iglesias?isActive=false` |
| Actividades | `GET /api/actividades?isActive=false` |
| Noticias | `GET /api/noticias?publicado=false` |

---

## El sitio web público

El sitio **no envía token** en ningún request. Todo lo que recibe ya viene filtrado: solo iglesias y actividades activas y solo noticias publicadas.

### Directorio de iglesias

1. **Llenar el filtro de distritos:**

   ```
   GET /api/iglesias/distritos
   → [{ "distrito": "Araucanía", "total": 12 }, ...]
   ```

   Se puede mostrar como "Araucanía (12)".

2. **Listar con filtros y paginación:**

   ```
   GET /api/iglesias?distrito=Araucanía&search=temuco&limit=12&offset=0
   ```

   La búsqueda no distingue tildes ni mayúsculas: el usuario puede escribir "concepcion".

3. **Detalle:** `GET /api/iglesias/:id`. Si trae `lat` y `lng`, mostrar el mapa.

### Calendario de actividades

```
GET /api/actividades?desde=2026-10-20&limit=50
```

- Usa **la fecha de hoy** en `desde`: así no aparecen las pasadas, pero sí las que están en curso (un retiro que empezó ayer).
- Vienen ordenadas por fecha: basta con [agruparlas por mes](#agrupar-actividades-por-mes).
- Para cada tarjeta:

| Si la actividad tiene… | La tarjeta muestra |
|---|---|
| `fecha_fin` | "Hasta el 25 de octubre" |
| sin `fecha_fin` | La hora de `fecha_inicio`: "19:00 h" |
| `inscripcion_url` | Botón "Inscribirme" que abre ese enlace |
| `distrito: "Nacional"` | La etiqueta con el estilo de "Nacional" |

- "Agregar a mi calendario" se arma en el front con las fechas ([ejemplo](#agregar-a-google-calendar)).

### Noticias

1. **Listado (tarjetas):**

   ```
   GET /api/noticias?limit=9
   GET /api/noticias?categoria=Oraci%C3%B3n
   ```

   Vienen de la más reciente a la más antigua y **sin `contenido`** (más livianas).

2. **Detalle:** `GET /api/noticias/:id` → trae `contenido` completo y el autor.

3. **Imagen:** si no hay `imagen`, mostrar el placeholder con el ícono de la categoría:

| `categoria` | Ícono |
|---|---|
| Misiones | ubicación |
| Comunicado oficial | diario |
| Oración | corazón |
| Historia | diario |

---

## Código para el frontend

Ejemplos en JavaScript, sin librerías. Sirven igual en React, Vue, Angular o JS puro.

### Cliente de la API

```js
const API = 'http://localhost:3500/api';

/**
 * Llama a la API. Agrega el token si existe y convierte los errores en excepciones
 * con el status y el mensaje que devolvió el servidor.
 */
export async function api(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(API + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const error = new Error(Array.isArray(data?.message) ? data.message.join('\n') : data?.message);
    error.status = res.status;
    error.messages = Array.isArray(data?.message) ? data.message : [data?.message];
    throw error;
  }
  return data;
}
```

### Login y sesión (panel)

```js
export async function login(email, password) {
  const { accessToken, expiresIn, user, menu } = await api('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  localStorage.setItem('session', JSON.stringify({
    token: accessToken,
    expiresAt: Date.now() + expiresIn * 1000,
    user,
    menu,
  }));
  return { user, menu };
}

export function getSession() {
  const session = JSON.parse(localStorage.getItem('session') ?? 'null');
  if (!session || Date.now() > session.expiresAt) return null;  // vencida → al login
  return session;
}

export function logout() {
  localStorage.removeItem('session');
}
```

Uso en el panel, manejando los errores:

```js
try {
  const { token } = getSession();
  await api('/iglesias', { method: 'POST', token, body: { distrito: 'Araucanía', name: 'Iglesia de Angol' } });
} catch (e) {
  if (e.status === 401) { logout(); location.href = '/login'; }
  else if (e.status === 403) alert('No tienes permiso para esta acción');
  else alert(e.messages.join('\n'));   // 400: errores de validación
}
```

### Paginación

```js
async function cargarPagina(pagina, porPagina = 12) {
  const { data, total } = await api(`/iglesias?limit=${porPagina}&offset=${(pagina - 1) * porPagina}`);
  return { iglesias: data, totalPaginas: Math.ceil(total / porPagina) };
}
```

### Filtros en la URL
Usar `URLSearchParams` para que tildes y espacios viajen bien codificados:

```js
const params = new URLSearchParams({ distrito: 'Araucanía', search: 'temuco', limit: '12' });
const { data } = await api(`/iglesias?${params}`);
```

### Mostrar fechas
La API responde en UTC. **Siempre** formatear con la zona de Chile:

```js
const TZ = { timeZone: 'America/Santiago' };

const dia  = (f) => new Date(f).toLocaleDateString('es-CL', { ...TZ, day: 'numeric' });                       // "24"
const mes  = (f) => new Date(f).toLocaleDateString('es-CL', { ...TZ, month: 'short' }).replace('.', '').toUpperCase(); // "OCT"
const hora = (f) => new Date(f).toLocaleTimeString('es-CL', { ...TZ, hour: '2-digit', minute: '2-digit', hour12: false }) + ' h'; // "19:00 h"
const larga = (f) => new Date(f).toLocaleDateString('es-CL', { ...TZ, day: 'numeric', month: 'long', year: 'numeric' }); // "16 de marzo de 2026"

// Línea de la tarjeta de actividad: "Hasta el 25 de octubre" o "19:00 h"
const cuando = (a) => a.fecha_fin
  ? 'Hasta el ' + new Date(a.fecha_fin).toLocaleDateString('es-CL', { ...TZ, day: 'numeric', month: 'long' })
  : hora(a.fecha_inicio);
```

Y al **enviar** una fecha desde un formulario (`<input type="datetime-local">` da `"2026-10-31T19:00"`), agregarle la zona:

```js
const conZona = (valorInput) => `${valorInput}:00-03:00`;   // "2026-10-31T19:00:00-03:00"
```

> Chile usa `-03:00` en horario de verano y `-04:00` en invierno. Si el panel va a cargar fechas de todo el año, usa una librería de fechas (como `date-fns-tz` o `luxon`) para calcular el desfase correcto de cada fecha.

### Agrupar actividades por mes

```js
function agruparPorMes(actividades) {
  const grupos = new Map();
  for (const a of actividades) {
    const titulo = new Date(a.fecha_inicio)
      .toLocaleDateString('es-CL', { timeZone: 'America/Santiago', month: 'long', year: 'numeric' })
      .replace(/^./, (c) => c.toUpperCase());                 // "Octubre de 2026"
    if (!grupos.has(titulo)) grupos.set(titulo, []);
    grupos.get(titulo).push(a);
  }
  return grupos;   // Map en orden: { "Octubre de 2026" => [...], "Noviembre de 2026" => [...] }
}

const hoy = new Date().toISOString().slice(0, 10);
const { data } = await api(`/actividades?desde=${hoy}&limit=50`);
const meses = agruparPorMes(data);
```

### Agregar a Google Calendar

```js
function enlaceGoogleCalendar(a) {
  const formato = (f) => new Date(f).toISOString().replace(/[-:]|\.\d{3}/g, '');   // 20261024T120000Z
  const fin = a.fecha_fin ?? new Date(new Date(a.fecha_inicio).getTime() + 2 * 3600_000); // sin fin: 2 horas
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: a.titulo,
    dates: `${formato(a.fecha_inicio)}/${formato(fin)}`,
    details: a.descripcion ?? '',
    location: a.lugar ?? '',
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
```

---

## Recetas: tareas frecuentes

| Quiero… | Request |
|---|---|
| Reactivar algo desactivado | `PATCH /api/<seccion>/:id` con `{ "isActive": true }` |
| Publicar un borrador | `PATCH /api/noticias/:id` con `{ "publicado": true }` |
| Despublicar una noticia (sin borrarla) | `PATCH /api/noticias/:id` con `{ "publicado": false }` |
| Cargar una noticia antigua con su fecha | `POST /api/noticias` con `"publicado": true, "fecha_publicacion": "2025-11-12T12:00:00-03:00"` |
| Quitar el botón "Inscribirme" | `PATCH /api/actividades/:id` con `{ "inscripcion_url": null }` |
| Convertir una actividad en nacional | `PATCH /api/actividades/:id` con `{ "distrito": "" }` |
| Quitar la ubicación de una iglesia | `PATCH /api/iglesias/:id` con `{ "lat": null, "lng": null }` |
| Cambiar los roles de alguien | `PATCH /api/auth/:id` con `{ "roles": ["DISTRITO"] }` (reemplaza todos) |
| Quitarle el acceso a alguien al instante | `DELETE /api/auth/:id` |
| Desbloquear una cuenta (3 intentos fallidos) | Hoy solo por Mongo: `db.users.updateOne({email:"x@iglesia.cl"},{$set:{retry:0}})` |
| Cambiar la contraseña de alguien | `PATCH /api/auth/:id` con `{ "password": "nueva-clave" }` |
| Agregar una categoría de noticias | Sumarla en `src/noticias/interfaces/categoria.enum.ts` (y su ícono en el front) |
| Darle una sección del menú a otro rol | Agregar el rol en `src/auth/menu/menu.config.ts`: cambia el menú **y** los permisos de la API |

---

## Problemas comunes

| Síntoma | Causa | Solución |
|---|---|---|
| `401` `missing_credentials` | No se envió el header | Agregar `Authorization: Bearer <token>` |
| `401` `malformed token` | El token está cortado o mal copiado | Copiar el `accessToken` completo, sin comillas |
| `401` `unknown subject` | El usuario fue desactivado o eliminado | Reactivarlo (`PATCH /auth/:id` `{ "isActive": true }`) |
| `401` después de varias horas | El token venció (8 h) | Volver a hacer login |
| `403` `Forbidden` | El rol no tiene permiso | Revisar la tabla de [permisos](seguridad.md#permisos-por-endpoint) |
| `400` `property X should not exist` | Se envió un campo que no existe | Quitarlo; revisar los campos en [api.md](api.md) |
| `400` `X is not a valid id` | El id no tiene formato de Mongo | Usar el `_id` que devuelve la API (24 caracteres) |
| La hora sale 3 horas corrida | La fecha se mostró en UTC, o se envió sin zona | Enviar con `-03:00` y mostrar con `timeZone: 'America/Santiago'` |
| La búsqueda no encuentra algo | El filtro `distrito` es exacto | Para "contiene", usar `search` (busca en el nombre) |
| Un visitante no ve una noticia | Es un borrador, o está desactivada | Publicarla (`PATCH` `{ "publicado": true }`) |
| `400` "The user ... is blocked" | 3 contraseñas incorrectas seguidas | Poner `retry: 0` en Mongo (ver recetas) |
| La app no arranca: "JWT_SECRET must be defined" | Falta el secreto o es corto | Ponerlo en `.env` con 32 caracteres o más |
| La app no conecta a Mongo | `STAGE` no es `dev` ni `production` | Revisar `STAGE` en `.env` |
