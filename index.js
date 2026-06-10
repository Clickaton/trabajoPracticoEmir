import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config(); // Inicializar variables de entorno

const app = express();

// IMPORTANTE PARA RENDER: process.env.PORT permite que Render asigne su propio puerto.
const PORT = process.env.PORT || 3000;

// Recrear __filename y __dirname LA CLAVE PARA QUE NO FALLE EN RENDER
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Importar enrutadores
import userRoutes from './routes/userRoutes.js';
import cohorteRoutes from './routes/cohorteRoutes.js';
import materiaRoutes from './routes/materiaRoutes.js';
import alumnoRoutes from './routes/alumnoRoutes.js';
import administrativoRoutes from './routes/administrativo.routes.js';
import correlatividadRoutes from './routes/correlatividades.routes.js';
import historialAcademicoRoutes from './routes/historialAcademico.routes.js';
import estadoAcademicoRoutes from './routes/estadoAcademico.routes.js';
import periodoInscripcionRoutes from './routes/periodoInscripcion.routes.js';
import inscripcionRoutes from './routes/inscripcion.routes.js';

// Conexión a MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Conectado exitosamente a MongoDB Atlas'))
  .catch((error) => console.error('Error conectando a MongoDB:', error));

// Configuración del motor de plantillas Pug
//app.set('view engine', 'pug');
//app.set('views', './views');

// Configuración del motor de plantillas Pug usando la ruta absoluta
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Usar enrutadores
app.use('/', userRoutes);
app.use('/', cohorteRoutes);
app.use('/', alumnoRoutes);
app.use('/api', materiaRoutes);
app.use('/api/administrativos', administrativoRoutes);
app.use('/api/correlatividades', correlatividadRoutes);
app.use('/api/historial', historialAcademicoRoutes);
app.use('/api/estado-academico', estadoAcademicoRoutes);
app.use('/api/periodos-inscripcion', periodoInscripcionRoutes);
app.use('/api/inscripciones', inscripcionRoutes);

app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});