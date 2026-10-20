# API Iglesia

API REST para la Convención: alimenta el **sitio web público** (directorio de iglesias, calendario de actividades, noticias) y el **panel administrativo** donde cada usuario gestiona lo que su rol le permite.

Hecha con **NestJS 12**, **MongoDB** (Mongoose) y los módulos oficiales `@nestjs/authentication`, `@nestjs/authorization` y `@nestjs/mail`.

## Documentación

| Documento | Qué explica |
|---|---|
| [docs/guia-de-uso.md](docs/guia-de-uso.md) | **Empieza aquí.** Primeros pasos, flujos del panel y del sitio, código para el frontend, recetas y problemas comunes |
| [docs/api.md](docs/api.md) | Todos los endpoints: permisos, campos, ejemplos `curl` y respuestas reales, incluidos los errores |
| [docs/seguridad.md](docs/seguridad.md) | Login, tokens, roles, menú y quién puede hacer qué (y por qué) |
| [docs/correo.md](docs/correo.md) | Envío de correos: configuración (desarrollo y SMTP), plantillas y cómo agregar un correo nuevo |
| [docs/arquitectura.md](docs/arquitectura.md) | Estructura de carpetas, el camino de un request y las decisiones de diseño |
| [docs/iglesia.postman_collection.json](docs/iglesia.postman_collection.json) | Colección de Postman con los 41 requests listos (el login guarda el token solo) |
| [docs/requests.http](docs/requests.http) | Los mismos requests para la extensión REST Client de VS Code |

## Puesta en marcha

### Requisitos
- Node.js 20.19 o superior (se usa 24)
- Yarn 4 (viene definido en `package.json`)
- Docker, para MongoDB

### 1. Variables de entorno
Crea un archivo `.env` en la raíz (no se sube a git):

```env
STAGE=dev                 # dev: usa la BD de config.yaml | production: usa URI y DBNAME
JWT_SECRET=...            # mínimo 32 caracteres; firma los tokens
PORT_DB=27017             # puerto de Mongo para docker-compose
MONGODB_DATABASE=iglesia

# Correo (config.yaml viene con Gmail, ver docs/correo.md). Sin MAIL_USER la app no arranca;
# para no enviar nada, pon email.transport: "file" en config.yaml
MAIL_USER=tu-cuenta@gmail.com
MAIL_PASSWORD=...         # contraseña de aplicación de Gmail (16 letras), no la de la cuenta

# Dominios que pueden llamar a la API desde el navegador. Sin definir: todos (solo para desarrollo)
# CORS_ORIGINS=https://iglesia.cl,https://panel.iglesia.cl

# Solo en producción (STAGE=production):
# URI=mongodb://usuario:clave@host:27017
# DBNAME=iglesia
```

Para generar un `JWT_SECRET` seguro:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

### 2. Base de datos

```bash
docker compose up -d
```

Levanta Mongo 6 en el contenedor `IGLESIA_CONTAINER`; los datos quedan en la carpeta `./mongo` (ignorada por git).

### 3. Instalar y arrancar

```bash
yarn install
```

```bash
yarn start:dev
```

La API queda en `http://localhost:3500/api` (el puerto se define en `src/conf/config.yaml`).

### 4. Crear el primer administrador
El registro público siempre crea usuarios con rol `IGLESIA`. Regístrate con `POST /api/auth/register` y luego súbete a ADMIN directamente en Mongo:

```bash
docker exec IGLESIA_CONTAINER mongosh iglesia --eval 'db.users.updateOne({email:"tu@correo.cl"},{$set:{roles:["ADMIN"]}})'
```

Desde ahí, ese ADMIN asigna roles a los demás con `PATCH /api/auth/:id`.

## Scripts

| Comando | Para qué |
|---|---|
| `yarn start:dev` | Desarrollo, se reinicia al guardar |
| `yarn build` | Compila a `dist/` |
| `yarn start:prod` | Corre lo compilado (el puerto puede cambiarse con la variable `PORT`) |
| `yarn test` | Tests unitarios (Vitest) |
| `yarn lint` | Revisión de código (oxlint) |
| `yarn format` | Formatea con Prettier |

## Mapa rápido

```
src/
├── main.ts            Arranque: prefijo /api, CORS, validación global
├── app.module.ts      Une todos los módulos y conecta Mongo
├── conf/              Configuración (config.yaml)
├── common/            Utilidades compartidas: paginación, validar ids, búsqueda sin tildes
├── auth/              Usuarios, login, tokens, roles, menú
├── iglesias/          Directorio de iglesias
├── actividades/       Calendario de actividades
├── noticias/          Noticias y comunicados
└── correo/            Envío de correos: configuración, clases de correo y plantillas HTML
```

## Problemas conocidos

Cosas detectadas que aún no se corrigen; están explicadas en el documento correspondiente.

- **`POST /api/iglesias` está abierto sin login** (el `@Roles` está comentado). Ver [api.md](docs/api.md#post-iglesias).
- **No hay límite de intentos por IP** en el login: el bloqueo es por usuario. Ver [seguridad](docs/seguridad.md#problemas-conocidos).
- **CORS acepta cualquier origen si no se define `CORS_ORIGINS`**; en producción hay que definirlo.
