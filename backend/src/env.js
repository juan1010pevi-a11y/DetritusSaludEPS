import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Carga las credenciales (correo, Twilio, llaves) desde un archivo .env, sin importar
 * cómo se arranque el servicio: npm start, npm run notifications, node src/xxx.js…
 * Se buscan, en orden: backend/.env y el .env de la raíz del proyecto (junto a
 * docker-compose.yml). Las variables ya definidas en la terminal tienen prioridad.
 */
const backendDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ENV_FILES = [path.join(backendDir, '.env'), path.join(backendDir, '..', '.env')];
export const loadedEnvFiles = [];

if (process.env.DETRITUS_SKIP_ENV_FILE !== '1') {
  for (const file of ENV_FILES) {
    if (!fs.existsSync(file)) continue;
    try {
      process.loadEnvFile(file);
      loadedEnvFiles.push(file);
    } catch (error) {
      console.warn(`No se pudo leer ${file}: ${error.message}`);
    }
  }
}
