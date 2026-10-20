# Referencia de la API

Base: `http://localhost:3500/api`

- Las rutas protegidas necesitan `Authorization: Bearer <accessToken>` (se obtiene en el login).
- Los bodies van en JSON (`Content-Type: application/json`).
- **Cualquier campo que no esté en la lista de cada endpoint se rechaza con 400.**
- Los permisos completos por rol están en [seguridad.md](seguridad.md#permisos-por-endpoint).

## Respuestas de error

| Código | Cuándo |
|---|---|
| 400 | Datos inválidos, id con formato incorrecto, duplicado, regla de negocio (fechas, coordenadas) |
| 401 | Sin token, token vencido o inválido, credenciales incorrectas |
| 403 | Con token pero sin el rol necesario |
| 404 | No existe, está desactivado (para visitantes) o es un borrador (para visitantes) |

Los 400 de validación traen la lista de problemas:

```json
{ "message": ["lat must be a latitude string or number"], "error": "Bad Request", "statusCode": 400 }
```

## Listados

Todos los `GET` de lista aceptan:

| Parámetro | Default | Descripción |
|---|---|---|
| `search` | | Busca en el nombre o título. Sin distinguir mayúsculas ni tildes |
| `limit` | 20 | Máximo 100 |
| `offset` | 0 | Cuántos saltar (página 2 con limit 20 → `offset=20`) |

Y responden:

```json
{ "total": 42, "limit": 20, "offset": 0, "data": [ ... ] }
```

---

## Auth — `/api/auth`

### `POST /auth/register` · público
Crea un usuario con rol `IGLESIA`.

```json
{
  "name": "José",
  "last_name": "Muñoz",
  "email": "jose@iglesia.cl",
  "password": "secreto123"
}
```

| Campo | Reglas |
|---|---|
| `name`, `last_name` | Obligatorios. Solo letras (con tildes/ñ) y espacios. Se guardan en minúsculas |
| `email` | Obligatorio, único |
| `password` | 6 a 50 caracteres |

Responde `201` con `{ user, accessToken, expiresIn }`.

### `POST /auth/login` · público

```json
{ "email": "jose@iglesia.cl", "password": "secreto123" }
```

Responde `200`:

```json
{
  "user": { "_id": "...", "name": "josé", "last_name": "muñoz", "email": "jose@iglesia.cl", "roles": ["IGLESIA"], ... },
  "accessToken": "eyJhbGciOi...",
  "expiresIn": 28800,
  "menu": [
    { "titulo": "Resumen", "icono": "grafico" },
    { "titulo": "Iglesias", "icono": "templo" },
    { "titulo": "Actividades", "icono": "calendario" },
    { "titulo": "Mensajes", "icono": "bandeja" }
  ]
}
```

`expiresIn` está en segundos (28800 = 8 horas). El `menu` depende de los roles del usuario.

### `GET /auth/me` · cualquier usuario con token
Devuelve el usuario del token.

### `GET /auth` · ADMIN
Lista los usuarios activos (sin paginar).

### `GET /auth/:id` · ADMIN

### `PATCH /auth/:id` · ADMIN
Todos los campos del registro son opcionales, más:

```json
{ "roles": ["DISTRITO", "COMUNICACIONES"], "isActive": true }
```

`roles` solo acepta `ADMIN`, `COMUNICACIONES`, `DISTRITO`, `IGLESIA`, sin repetir. Si se envía `password`, se guarda el nuevo hash.

### `DELETE /auth/:id` · ADMIN
Desactiva el usuario. Sus tokens dejan de funcionar de inmediato.

---

## Iglesias — `/api/iglesias`

### `GET /iglesias` · público (el panel ve más)

| Parámetro | Descripción |
|---|---|
| `distrito` | Distrito exacto, sin distinguir mayúsculas ni tildes |
| `search` | Busca en `name` |
| `isActive` | Solo panel: `false` lista las desactivadas |

Ordenadas por distrito y nombre.

```
GET /api/iglesias?distrito=araucania&search=temuco
```

### `GET /iglesias/distritos` · público
Para llenar el filtro del sitio. Solo cuenta iglesias activas, en orden alfabético español.

```json
[
  { "distrito": "Araucanía", "total": 12 },
  { "distrito": "Biobío", "total": 8 },
  { "distrito": "Ñuble", "total": 3 }
]
```

### `GET /iglesias/:id` · público (el panel también ve desactivadas)

### `POST /iglesias` · DISTRITO, ADMIN

```json
{
  "distrito": "Araucanía",
  "name": "Iglesia Bautista de Temuco",
  "direccion": "Av. Alemania 0450, Temuco",
  "reuniones": "Domingo 11:00, Miércoles 19:30",
  "encargado": "Pastor Juan Pérez",
  "email": "contacto@iglesiatemuco.cl",
  "lat": -38.7359,
  "lng": -72.5904
}
```

| Campo | Reglas |
|---|---|
| `distrito` | Obligatorio, máx. 100 |
| `name` | Obligatorio, máx. 150. **Único dentro del distrito** (sin distinguir mayúsculas) |
| `direccion`, `reuniones` | Opcionales, máx. 250 |
| `encargado` | Opcional, máx. 150 |
| `email` | Opcional, email válido. Se guarda en minúsculas |
| `lat`, `lng` | Opcionales, **números**. **Van juntas o ninguna** |

Los espacios repetidos o en los extremos de `distrito`, `name`, `direccion` y `encargado` se eliminan.

### `PATCH /iglesias/:id` · DISTRITO, ADMIN
Cualquier campo del POST, más `isActive`. Solo se cambia lo enviado.

```json
{ "reuniones": "Domingo 10:30" }
```

```json
{ "isActive": true }
```

```json
{ "lat": null, "lng": null }
```

El último borra la ubicación.

### `DELETE /iglesias/:id` · ADMIN
Desactiva la iglesia (deja de verse en el sitio). Se reactiva con `PATCH { "isActive": true }`.

---

## Actividades — `/api/actividades`

### `GET /actividades` · público (el panel ve más)

| Parámetro | Descripción |
|---|---|
| `desde` | Fecha ISO. Actividades que **siguen vigentes** desde esa fecha (incluye las que empezaron antes y no han terminado) |
| `hasta` | Fecha ISO. Actividades que **empiezan** hasta esa fecha |
| `distrito` | Exacto, sin tildes. `Nacional` devuelve las nacionales |
| `search` | Busca en `titulo` |
| `isActive` | Solo panel: `false` lista las desactivadas |

Ordenadas por `fecha_inicio` ascendente, listas para agrupar por mes.

```
GET /api/actividades?desde=2026-10-24&limit=50
```

### `GET /actividades/:id` · público (el panel también ve desactivadas)

### `POST /actividades` · COMUNICACIONES, DISTRITO, ADMIN

```json
{
  "titulo": "Retiro de jóvenes",
  "descripcion": "Dos días de alabanza, enseñanza y convivencia para jóvenes de 15 a 30 años.",
  "fecha_inicio": "2026-10-24T09:00:00-03:00",
  "fecha_fin": "2026-10-25T18:00:00-03:00",
  "lugar": "Temuco",
  "distrito": "Araucanía",
  "inscripcion_url": "https://forms.gle/abc123"
}
```

| Campo | Reglas |
|---|---|
| `titulo` | Obligatorio, máx. 100 |
| `descripcion` | Opcional, máx. 500 |
| `fecha_inicio` | Obligatoria, fecha ISO **con zona horaria** |
| `fecha_fin` | Opcional. Solo en actividades de varios días. No puede ser anterior a `fecha_inicio` |
| `lugar` | Opcional, máx. 100 (`"Temuco"`, `"En línea"`) |
| `distrito` | Opcional. Si no viene o viene vacío → `"Nacional"` |
| `inscripcion_url` | Opcional, URL. Si existe, el sitio muestra "Inscribirme" |

Cómo lo muestra el sitio:
- **Con `fecha_fin`:** "Hasta el 25 de octubre".
- **Sin `fecha_fin`:** la hora de `fecha_inicio` ("19:00 h").
- **"Agregar a mi calendario":** lo arma el front con las fechas.

### `PATCH /actividades/:id` · COMUNICACIONES, DISTRITO, ADMIN
Cualquier campo del POST, más `isActive`. Las fechas se validan contra lo ya guardado.

Para quitar el botón de inscripción:

```json
{ "inscripcion_url": null }
```

### `DELETE /actividades/:id` · ADMIN
Desactiva la actividad.

---

## Noticias — `/api/noticias`

### `GET /noticias` · público (el panel ve más)

| Parámetro | Descripción |
|---|---|
| `publicado` | Solo panel: `false` lista los borradores. Los visitantes siempre reciben solo publicadas |
| `categoria` | `Misiones`, `Comunicado oficial`, `Oración` o `Historia` |
| `search` | Busca en `titulo` |

Ordenadas por `fecha_publicacion`, la más reciente primero. **El listado no incluye `contenido`** (solo el detalle).

```
GET /api/noticias?categoria=Oraci%C3%B3n&limit=6
```

### `GET /noticias/:id` · público (el panel también ve borradores)
Incluye `contenido` y el autor (`{ _id, name, last_name }`).

### `POST /noticias` · COMUNICACIONES, ADMIN

```json
{
  "titulo": "Congreso de Misiones 2026 reunió a iglesias de todo el país",
  "resumen": "Tres días de formación en Koyamentu con invitados de Brasil, México y Chile.",
  "contenido": "Texto completo de la noticia...",
  "categoria": "Misiones",
  "imagen": "https://cdn.ejemplo.cl/congreso.jpg",
  "publicado": true,
  "fecha_publicacion": "2026-03-16T12:00:00-03:00"
}
```

| Campo | Reglas |
|---|---|
| `titulo` | Obligatorio, máx. 200 |
| `resumen` | Obligatorio, máx. 300. Es el texto de la tarjeta |
| `contenido` | Obligatorio, máx. 20.000 |
| `categoria` | Obligatoria, una de las 4 |
| `imagen` | Opcional, URL. Sin imagen, el sitio muestra el ícono de la categoría |
| `publicado` | Opcional, por defecto `false` (borrador) |
| `fecha_publicacion` | Opcional. Si se publica sin fecha, se usa el momento actual. Sirve para cargar noticias antiguas |

**No se envía `autor`:** se toma del token.

### `PATCH /noticias/:id` · COMUNICACIONES, ADMIN
Cualquier campo del POST, más `isActive`.

Para publicar un borrador:

```json
{ "publicado": true }
```

Si no tenía `fecha_publicacion`, se le asigna ahora. Si se despublica, la fecha se conserva.

### `DELETE /noticias/:id` · ADMIN
Desactiva la noticia.

---

## Otros

### `GET /api` · público
Responde `Hello World!`. Sirve para comprobar que la API está arriba.
