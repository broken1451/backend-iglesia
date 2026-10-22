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
4. Al crear una iglesia, actividad o noticia, su `_id` también se guarda (`iglesiaId`, `actividadId`, `noticiaId`), y "Mensajes → Listar todos" guarda el del primer mensaje (`mensajeId`), así que "Ver", "Editar" y "Desactivar" funcionan sin copiar ids.
5. Para probar todo de una vez: clic derecho en la colección → **Run collection**. Los 65 requests están en el orden en que se pueden correr seguidos (con un usuario ADMIN en `email` / `password`).

| Carpeta | Qué trae |
|---|---|
| Auth (2) | Login y mi usuario |
| Iglesias (14) | Listados del sitio y del panel (desactivadas, fichas incompletas y completas), búsqueda por comuna, distritos, crear, editar, completar ficha |
| Usuarios (10) | Registro (con la iglesia creada antes) y la gestión del ADMIN: datos, iglesia, roles, clave, desactivar, desbloquear |
| Actividades (13) | Próximas, nacionales, rango de fechas, por completar, crear, editar, inscritos, desactivar |
| Noticias (13) | Listado, categoría, búsqueda, borradores, desactivadas, sin imagen, crear, publicar, editar |
| Mensajes (10) | Formulario del sitio (sin token), listar, buscar, ver, marcar leído / no leído, archivar, recuperar |
| Resumen (2) | La pantalla Resumen completa y solo el "Por hacer" |
| Salud (1) | `GET /api` |

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
La iglesia es opcional en el registro (`"iglesia": "<_id>"` la asocia). Para la cuenta que vas a convertir en ADMIN no hace falta:

```bash
curl -X POST http://localhost:3500/api/auth/register -H "Content-Type: application/json" -d '{"name":"Ana","last_name":"Rojas","email":"ana@iglesia.cl","password":"una-clave-segura"}'
```

Queda con rol `IGLESIA`, y te llega el correo de bienvenida (o, si `email.transport` es `"file"`, queda como `.eml` en la carpeta `mails/`). Para configurar el envío ver [correo.md](correo.md).

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
| `401` en el login | "Correo o contraseña incorrectos" (la API no distingue cuál de los dos, a propósito) |
| `403` en el login | Mostrar el mensaje: la cuenta está bloqueada, o es un usuario IGLESIA sin iglesia asignada. En ambos casos debe pedirle a un ADMIN que lo resuelva |
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
| Noticias | `GET /api/noticias?publicado=false` (borradores) o `?isActive=false` (desactivadas) |

### La pantalla Resumen
**Un solo request** arma toda la pantalla: `GET /api/resumen` ([detalle de cada bloque](api.md#get-resumen)).

| En pantalla | Campo de la respuesta |
|---|---|
| Fichas completas · 0 de 48 (y la barra) | `tarjetas.fichas.completas`, `.total`, `.porcentaje`, `.detalle` |
| Mensajes sin leer · 3 · 4 en total | `tarjetas.mensajes.sinLeer`, `.total` |
| Próximas actividades · 6 · 105 personas inscritas | `tarjetas.actividades.proximas`, `.inscritos` |
| Noticias publicadas · 4 · 1 en borrador | `tarjetas.noticias.publicadas`, `.borradores` |
| Por hacer (y el número del recuadro) | `porHacer.items`, `porHacer.total` |
| Accesos rápidos | `accesosRapidos` (`titulo`, `icono`, `ruta`) |
| Actividad reciente | `actividadReciente` (`fecha`, `texto`) |
| Avance de fichas por distrito | `avanceDistritos.detalle` y `.distritos` (`nombre`, `zona`, `iglesias`, `porcentaje`) |

Un bloque en `null` significa que el rol no ve esa sección: no se dibuja. Para refrescar solo el "Por hacer" (por ejemplo, al volver de completar una ficha): `GET /api/resumen/por-hacer`.

**El botón "Ir" del Por hacer** lleva a la `ruta` de cada tarjeta:

| Tarjeta | `ruta` |
|---|---|
| Completar N fichas de iglesia | `iglesias?pendientes=true`: la lista de iglesias con datos faltantes |
| Completar N actividades próximas | `actividades?pendientes=true&desde=<hoy>` |
| Responder N mensajes | `mensajes?leido=false` |
| Terminar el borrador de noticia | `noticias/<id>`: ese borrador |
| Revisar N borradores más | `noticias?publicado=false` |

Además, cada iglesia, actividad y noticia trae `pendientes` (ej. `["encargado", "telefono"]`), para marcar en la tabla del panel qué le falta a cada fila.

### Formulario "Agregar iglesia"
- El selector **Distrito** se llena con `GET /api/iglesias/distritos`: cada opción con `value` = `id` (`"araucania"`) y texto = `nombre` (y `zona` como ayuda), ya en orden de norte a sur. Es la misma forma `{ id, nombre, zona }` que la lista `DISTRITOS` del front, así que el front puede dejar de tenerla escrita y pedirla aquí.
- Al editar, la iglesia trae `distrito_id` para preseleccionar el selector.
- "Guardar" envía `POST /api/iglesias` con `name`, `comuna`, `distrito`, `direccion`, `reuniones`, `encargado`, `email`, `telefono`, y `lat` / `lng` del punto del mapa (las dos o ninguna). Al editar, `PATCH /api/iglesias/:id` solo con lo que cambió.
- Los errores llegan como `400` con la lista de mensajes; cada uno empieza con el nombre del campo (`"telefono must be..."`), para mostrarlo bajo el campo correcto. [Detalle](api.md#post-iglesias).

### La tabla de iglesias
Cada fila de `GET /api/iglesias` trae lo que muestran las columnas: `name` y `comuna` (Iglesia), `distrito`, y `ficha` para **Ficha** ("0/5" y la barra con `ficha.porcentaje`) y **Estado** (`ficha.estado`: "Faltan 5", "Falta 1" o "Completa"; `ficha.completa` sirve para el color). Para filtrar la tabla: `?pendientes=true` (incompletas), `?pendientes=false` (completas), `?search=` (nombre o comuna). [Detalle](api.md#objeto-iglesia).

### Mensajes del sitio
- `GET /api/mensajes?leido=false` → los nuevos.
- Al abrir uno: `PATCH /api/mensajes/:id` con `{ "leido": true }` (deja de contar en "sin leer").
- Archivar: `DELETE /api/mensajes/:id` (ADMIN).

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

### Formulario de contacto
`POST /api/mensajes` sin token, con `nombre`, `email`, `mensaje` (y opcionales `telefono`, `asunto`). Responde `{ "message": "Mensaje recibido" }`; los errores de validación vienen como siempre (`400` con la lista de mensajes por campo).

```js
await api('/mensajes', { method: 'POST', body: { nombre, email, mensaje } });
```

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

### Recuadro "Por hacer"

```js
/**
 * Dibuja las tarjetas del "Por hacer". Recibe `porHacer` de GET /api/resumen (o la respuesta
 * de GET /api/resumen/por-hacer). `irA` es la función de navegación del panel.
 */
export function dibujarPorHacer({ total, items }, contenedor, irA) {
  contenedor.querySelector('.contador').textContent = total;
  contenedor.querySelector('.lista').replaceChildren(
    ...items.map((tarea) => {
      const fila = document.createElement('li');
      // textContent (no innerHTML): el título de un borrador lo escribe un usuario
      fila.innerHTML = `<span class="icono icono-${tarea.icono}"></span>
        <div><strong></strong><small></small></div>
        <button>Ir</button>`;
      fila.querySelector('strong').textContent = tarea.titulo;
      fila.querySelector('small').textContent = tarea.detalle;
      // ruta = "iglesias?pendientes=true": la misma ruta del menú, con los filtros que
      // la pantalla de destino le pasa tal cual a GET /api/iglesias
      fila.querySelector('button').onclick = () => irA(`/${tarea.ruta}`);
      return fila;
    }),
  );
}
```

En la tabla de cada sección, `pendientes` sirve para marcar las filas incompletas:

```js
const nombres = {
  direccion: 'dirección', reuniones: 'horario', encargado: 'pastor', email: 'correo', telefono: 'teléfono',
  descripcion: 'descripción', lugar: 'lugar', imagen: 'imagen',
};
const aviso = (registro) => registro.pendientes.length ? `Falta: ${registro.pendientes.map((campo) => nombres[campo]).join(', ')}` : '';
```

### Actividad reciente

```js
// fecha viene en UTC: "20 oct" en hora de Chile
const dia = (fecha) => new Date(fecha).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', timeZone: 'America/Santiago' });
const lineas = resumen.actividadReciente.map(({ fecha, texto }) => `${dia(fecha)}  ${texto}`);
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
| Ver qué iglesias tienen la ficha incompleta | `GET /api/iglesias?pendientes=true` (con token del panel) |
| Cargar los inscritos de una actividad | `PATCH /api/actividades/:id` con `{ "inscritos": 60 }` |
| Marcar un mensaje como leído | `PATCH /api/mensajes/:id` con `{ "leido": true }` |
| Cambiar los accesos rápidos del Resumen | `ACCESOS_RAPIDOS` en `src/auth/menu/menu.config.ts` |
| Cambiar qué datos cuentan como "ficha completa" | `CAMPOS_FICHA_*` en la entidad (`iglesia.entity.ts`, `actividad.entity.ts`, `noticia.entity.ts`) |
| Darle permiso de edición de una sección a otro rol | Agregar el rol en `editan` de `menu.config.ts`: cambia los `@Roles` de POST/PATCH **y** el "Por hacer" |
| Asignar o cambiar la iglesia de un usuario | `PATCH /api/auth/:id` con `{ "iglesia": "<_id>" }` |
| Desbloquear una cuenta (3 intentos fallidos) | `PATCH /api/auth/:id` con `{ "unblock": true }` |
| Cambiar la contraseña de alguien | `PATCH /api/auth/:id` con `{ "password": "nueva-clave" }` |
| Agregar una categoría de noticias | Sumarla en `src/noticias/interfaces/categoria.enum.ts` (y su ícono en el front) |
| Agregar un distrito | Sumarlo en `src/iglesias/distritos.ts` con su `id`, `nombre` y `zona`, en su lugar (de norte a sur). Si el front tiene la lista escrita, también allá |
| Darle una sección del menú a otro rol | Agregar el rol en `src/auth/menu/menu.config.ts`: cambia el menú **y** los permisos de la API |
| Ver un correo sin enviarlo | `email.transport: "file"` en `config.yaml`, y abrir el `.eml` de `mails/` |
| Enviar correos de verdad | `transport: "smtp"` + `MAIL_USER` / `MAIL_PASSWORD` en `.env` ([correo.md](correo.md#enviar-de-verdad-smtp)) |
| Cambiar el diseño o el texto de un correo | Editar `src/correo/templates/*.html` (en desarrollo se ve sin reiniciar) |
| Agregar un correo nuevo | Ver [correo.md](correo.md#agregar-un-correo-nuevo) |
| Limitar qué dominios llaman a la API | `CORS_ORIGINS=https://iglesia.cl,https://panel.iglesia.cl` en `.env` |

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
| `403` "Users with the IGLESIA role need an active iglesia" en el login | Usuario IGLESIA sin iglesia, o su iglesia fue desactivada | Un ADMIN: `PATCH /api/auth/:id` con `{ "iglesia": "<_id>" }` |
| `400` "iglesia must be the _id of an iglesia" al registrarse | Falta elegir la iglesia | Mandar `iglesia` con el `_id` de una iglesia de `GET /api/iglesias` |
| `403` "The user is blocked..." en el login | 3 contraseñas incorrectas seguidas | Un ADMIN: `PATCH /api/auth/:id` con `{ "unblock": true }` |
| `401` "Invalid credentials" con la clave correcta | El usuario fue desactivado | Un ADMIN lo reactiva: `PATCH /api/auth/:id` `{ "isActive": true }` |
| La app no arranca: "JWT_SECRET must be defined" | Falta el secreto o es corto | Ponerlo en `.env` con 32 caracteres o más |
| La app no arranca: "STAGE debe ser dev o production" | `STAGE` falta o tiene otro valor | Revisar `STAGE` en `.env` |
| La app no arranca: "hay que definir MAIL_USER" | `transport: "smtp"` sin cuenta de correo | Llenar `MAIL_USER` / `MAIL_PASSWORD` en `.env`, o usar `transport: "file"` |
| La app no arranca: "falta email.host" | `transport: "smtp"` sin servidor | Poner `host` y `port` en `config.yaml` (Gmail: `smtp.gmail.com`, `587`) |
| No llega el correo de bienvenida | Clave de Gmail incorrecta, o fue a spam | Ver la consola (`No se pudo enviar...`) y [correo.md](correo.md#si-no-llega) |
