import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as yaml from 'js-yaml';

const YAML_CONFIG_FILENAME = 'config.yaml';

const loadConfig = () => {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const configPath = join(__dirname, YAML_CONFIG_FILENAME);
  return yaml.load(
    readFileSync(configPath, 'utf8'),
  ) as Record<string, any>;
};

export default loadConfig;