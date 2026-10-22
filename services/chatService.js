import jwt from 'jsonwebtoken';
import { leerCookie } from '../utils/cookies.js';

// Chat de soporte con el asistente virtual (Socket.io).
//
// Es una consulta PRIVADA de cada persona con el asistente. Por eso:
//  - quién escribe se toma del JWT de la cookie de sesión, nunca de lo que mande el navegador (si no, cualquiera podía
//    hacerse pasar por otro alumno y pedirle al asistente sus notas);
//  - las respuestas vuelven solo al socket que preguntó (antes se emitían a todos los conectados).

export const MAX_CARACTERES_MENSAJE = 1000;
export const MAX_MENSAJES_HISTORIAL = 20;

const AVISOS = Object.freeze({
    sesionVencida: 'Tu sesión venció. Volvé a iniciar sesión para seguir chateando.',
    respondiendo: 'Esperá un momento: todavía estoy respondiendo tu consulta anterior.',
    error: 'Disculpá, tuve un problema al procesar tu consulta en este momento.'
});

// `consultarIA(pregunta, rol, pantalla, historial, usuario)` devuelve el texto de la respuesta.
export const configurarChat = (io, { consultarIA }) => {
    const chatsActivos = {};

    // Solo entran personas con sesión iniciada
    io.use((socket, next) => {
        const token = leerCookie(socket.handshake.headers.cookie, 'jwtToken');
        if (!token) return next(new Error('No autenticado'));

        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) return next(new Error('Sesión inválida o vencida'));
            socket.data.usuario = decoded;
            next();
        });
    });

    const responder = (socket, texto) => socket.emit('mensaje', { usuario: 'Asesor Virtual', texto });

    io.on('connection', (socket) => {
        chatsActivos[socket.id] = [];

        socket.on('mensaje', async (datos) => {
            const usuario = socket.data.usuario;

            // El token puede haber vencido con la pantalla abierta
            if (usuario?.exp && usuario.exp * 1000 < Date.now()) {
                responder(socket, AVISOS.sesionVencida);
                return socket.disconnect(true);
            }

            const texto = typeof datos?.texto === 'string' ? datos.texto.trim().slice(0, MAX_CARACTERES_MENSAJE) : '';
            if (!texto) return;

            if (socket.data.respondiendo) return responder(socket, AVISOS.respondiendo);

            const pantalla = typeof datos?.contexto === 'string' ? datos.contexto.slice(0, 80) : 'sistema general';
            const rol = usuario?.rol || usuario?.role || usuario?.tipoPerfil || '';
            const historial = chatsActivos[socket.id];

            socket.data.respondiendo = true;
            try {
                historial.push({ role: 'user', parts: [{ text: texto }] });

                const respuesta = await consultarIA(texto, rol, pantalla, historial, usuario);

                historial.push({ role: 'model', parts: [{ text: respuesta }] });
                // De a pares pregunta/respuesta: el historial siempre arranca con una pregunta
                while (historial.length > MAX_MENSAJES_HISTORIAL) historial.splice(0, 2);

                responder(socket, respuesta);
            } catch (error) {
                console.error('Error en el flujo del asistente:', error);
                historial.pop(); // la pregunta quedó sin respuesta: no se deja en el historial
                responder(socket, AVISOS.error);
            } finally {
                socket.data.respondiendo = false;
            }
        });

        socket.on('disconnect', () => {
            delete chatsActivos[socket.id];
        });
    });

    return chatsActivos;
};
