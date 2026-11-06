import { createServer } from 'http';
import { Server } from 'socket.io';
import { crearApp } from './app.js';
import { configurarChat } from './services/chatService.js';
import { consultarIAConHistorial } from './services/geminiService.js';

// Servidor HTTP = la aplicación Express + el chat en tiempo real (Socket.io).
// Socket.io necesita el servidor HTTP "de abajo", por eso el chat se conecta acá y no dentro de app.js.
export const crearServidor = () => {
    const servidorHttp = createServer(crearApp());
    const io = new Server(servidorHttp);

    // Chat de soporte con el asistente virtual (identidad por sesión y respuestas privadas: ver services/chatService.js)
    configurarChat(io, { consultarIA: consultarIAConHistorial });

    return servidorHttp;
};
