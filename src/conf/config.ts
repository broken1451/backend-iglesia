import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as yaml from 'js-yaml';

/** Archivo de configuración que vive junto a este (en src/conf y, compilado, en dist/conf). */
const YAML_CONFIG_FILENAME = 'config.yaml';

/**
 * Lee config.yaml y lo devuelve como objeto. Lo usa ConfigModule.forRoot({ load: [conf] })
 * en app.module.ts, y luego cualquier valor se obtiene con configService.get('mongo.url').
 *
 * Se busca relativo a este archivo (import.meta.url) y no a la carpeta desde donde se
 * ejecuta node, para que funcione igual con `yarn start:dev` que con `node dist/main`.
 * nest-cli.json se encarga de copiar el .yaml a dist/ al compilar.
 */
const loadConfig = () => {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const configPath = join(__dirname, YAML_CONFIG_FILENAME);
  return yaml.load(
    readFileSync(configPath, 'utf8'),
  ) as Record<string, any>;
};

export default loadConfig;