import express from 'express';
import cookieParser from 'cookie-parser';
import { CARPETA_VISTAS, CARPETA_PUBLICA } from './config/entorno.js';
import { identificarUsuario } from './middlewares/identificarUsuario.js';
import { rutaNoEncontrada, manejadorDeErrores } from './middlewares/errorHandler.js';
import rutasDelSistema from './routes/index.js';

// Arma la aplicación Express. No abre puertos ni se conecta a la base de datos: eso lo hacen index.js y server.js.
// Por eso se puede crear una app nueva en cada prueba automática, sin levantar nada.
export const crearApp = () => {
    const app = express();

    // Motor de plantillas Pug, con rutas absolutas (ver config/entorno.js)
    app.set('view engine', 'pug');
    app.set('views', CARPETA_VISTAS);

    // Lectura de los pedidos: JSON, formularios y cookies; y archivos estáticos (logo, estilos, imágenes)
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());
    app.use(express.static(CARPETA_PUBLICA));

    // Quién es la persona (a partir de la cookie con el JWT) y qué rutas existen
    app.use(identificarUsuario);
    app.use(rutasDelSistema);

    // Al final, en este orden: si ninguna ruta respondió, 404; y el manejador de errores
    // (ver middlewares/errorHandler.js: responde JSON a los fetch() y la página de error al navegar)
    app.use(rutaNoEncontrada);
    app.use(manejadorDeErrores);

    return app;
};
