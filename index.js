import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url'; 
import { consultarIAConHistorial } from './services/geminiService.js';
import { createServer } from 'http';
import { Server } from 'socket.io';

dotenv.config(); // Inicializar variables de entorno

const app = express();
// Crear el servidor HTTP envolviendo la app de Express
const httpServer = createServer(app);

// Inicializar Socket.io pasándole el servidor HTTP
const io = new Server(httpServer);

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
import Administrativo from './models/Administrativo.js';
import User from './models/User.js';

// ==========================================
// LÓGICA DEL CHAT WEBSOCKET
// ==========================================
const chatsActivos = {};

io.on("connection", (socket) => {
  console.log("Un usuario se conectó al chat");

  chatsActivos[socket.id] = [];

  socket.on("mensaje", async (datos) => {
    const textoUsuario = datos.texto?.trim() || "";
    const pantallaActual = datos.contexto || "sistema general";
    const usuario = datos.usuarioLogueado || null;
    const rolUsuario = usuario?.rol || usuario?.role || usuario?.tipoPerfil || "";

    if (!textoUsuario) return;

    io.emit("mensaje", {
      usuario: datos.usuario || "Usuario",
      texto: textoUsuario
    });

    try {
      chatsActivos[socket.id].push({
        role: "user",
        parts: [{ text: textoUsuario }]
      });

      const respuesta = await consultarIAConHistorial(
        textoUsuario,
        rolUsuario,
        pantallaActual,
        chatsActivos[socket.id]
      );

      chatsActivos[socket.id].push({
        role: "model",
        parts: [{ text: respuesta }]
      });

      io.emit("mensaje", {
        usuario: "Asesor Virtual",
        texto: respuesta
      });
    } catch (error) {
      console.error("Error en el flujo de Gemini con historial:", error);
      io.emit("mensaje", {
        usuario: "Asesor Virtual",
        texto: "Disculpá, tuve un problema al procesar tu consulta en este momento."
      });
    }
  });

  socket.on("disconnect", () => {
    delete chatsActivos[socket.id];
  });
});

/*
    Función para crear un usuario administrador por defecto si no existe.
*/
const crearDefaultAdminUser = async () => {
    try {
        const adminExistente = await Administrativo.findOne({ email: 'admin@admin.com' });

        if (!adminExistente) {
            await Administrativo.create({
                name: 'Administrador',
                email: 'admin@admin.com',
                password: 'admin123',
                rol: 'Administrativo',
                area: 'Sistema'
            });

            console.log('Usuario administrador por defecto creado.');     
        }

    } catch (error) {
        console.error('Error asegurando el usuario administrador por defecto:', error);
    }
};

// Conexión a MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('Conectado exitosamente a MongoDB Atlas');
    await crearDefaultAdminUser();

    httpServer.listen(PORT, () => {
        console.log(`Servidor escuchando en http://localhost:${PORT}`);
    });
  })
  .catch((error) => console.error('Error conectando a MongoDB:', error));

// Configuración del motor de plantillas Pug usando la ruta absoluta
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use((req, res, next) => {
    const token = req.cookies?.jwtToken || null;
    res.locals.jwtToken = token;

    if (!token) {
        res.locals.usuario = null;
        return next();
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            res.locals.usuario = null;
            return next();
        }

        req.user = decoded;
        res.locals.usuario = decoded;
        next();
    });
});

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

