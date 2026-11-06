// Punto de entrada del sistema: solo arranca. Cada tarea vive en su módulo:
//   config/    variables de entorno y conexión a la base de datos
//   server.js  servidor HTTP + chat      ·  app.js  aplicación Express (middlewares y rutas)
import { PUERTO, validarEntorno } from './config/entorno.js'; // tiene que ir primero: carga el archivo .env
import { conectarBaseDeDatos } from './config/baseDeDatos.js';
import { asegurarAdministradorPorDefecto } from './services/adminPorDefectoService.js';
import { crearServidor } from './server.js';

const iniciar = async () => {
    validarEntorno();
    await conectarBaseDeDatos();
    await asegurarAdministradorPorDefecto();

    crearServidor().listen(PUERTO, () => {
        console.log(`Servidor escuchando en http://localhost:${PUERTO}`);
    });
};

iniciar().catch((error) => {
    console.error('No se pudo iniciar el servidor:', error);
    process.exitCode = 1;
});
