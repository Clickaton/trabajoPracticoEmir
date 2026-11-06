import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Carga el archivo .env UNA sola vez. Tiene que ser lo primero que importa index.js: así, cuando se evalúan los demás
// módulos (que leen process.env), las variables ya existen.
dotenv.config();

// Carpeta raíz del proyecto, calculada desde la ubicación de este archivo y no desde la carpeta en la que se lanzó `node`.
// Es lo que evita que falle en el hosting (Render ejecuta el servidor desde otro directorio).
export const RAIZ_DEL_PROYECTO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CARPETA_VISTAS = path.join(RAIZ_DEL_PROYECTO, 'views');
export const CARPETA_PUBLICA = path.join(RAIZ_DEL_PROYECTO, 'public');

// Render asigna el puerto con la variable PORT; en la computadora local se usa el 3000.
export const PUERTO = process.env.PORT || 3000;

const VARIABLES_OBLIGATORIAS = ['MONGO_URI', 'JWT_SECRET'];

// Si falta algo imprescindible, el arranque se detiene con un mensaje claro (en vez de romper más tarde con un error confuso).
export const validarEntorno = () => {
    const faltantes = VARIABLES_OBLIGATORIAS.filter((nombre) => !process.env[nombre]);
    if (faltantes.length > 0) {
        throw new Error(`Faltan variables de entorno obligatorias en el archivo .env: ${faltantes.join(', ')}`);
    }
};
