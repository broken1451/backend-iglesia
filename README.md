# API Iglesia

API REST para la Convención: alimenta el **sitio web público** (directorio de iglesias, calendario de actividades, noticias) y el **panel administrativo** donde cada usuario gestiona lo que su rol le permite.

Hecha con **NestJS 12**, **MongoDB** (Mongoose) y los módulos oficiales `@nestjs/authentication` y `@nestjs/authorization`.

## Documentación

| Documento | Qué explica |
|---|---|
| [docs/arquitectura.md](docs/arquitectura.md) | Estructura de carpetas, el camino de un request y las decisiones de diseño |
| [docs/seguridad.md](docs/seguridad.md) | Login, tokens, roles, menú y quién puede hacer qué (y por qué) |
| [docs/api.md](docs/api.md) | Todos los endpoints con sus campos, permisos y ejemplos |

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
| `yarn start:prod` | Corre lo compilado |
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
└── noticias/          Noticias y comunicados
```

## Problemas conocidos

Cosas detectadas que aún no se corrigen; están explicadas en el documento correspondiente.

- **El login revela qué correos existen** (responde distinto si el correo no está registrado). Ver [seguridad](docs/seguridad.md#problemas-conocidos).
- **Un usuario bloqueado por intentos fallidos no tiene cómo desbloquearse** salvo editando `retry` en Mongo.
- **Si `STAGE` no es `dev` ni `production`, la URI de Mongo queda vacía** y la app no conecta. Además se imprime la URI en consola (en producción puede mostrar la clave).
- **El puerto solo se lee de `config.yaml`**; la variable `PORT` no tiene efecto.
- **CORS acepta cualquier origen**; antes de producción hay que limitarlo a los dominios del sitio y del panel.
- **Los tests de `auth` y `app` fallan** porque no tienen sus dependencias simuladas (los de `iglesias` y `common` sí pasan).
