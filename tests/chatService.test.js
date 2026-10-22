import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { configurarChat, MAX_CARACTERES_MENSAJE, MAX_MENSAJES_HISTORIAL } from '../services/chatService.js';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-prueba-del-chat';

// Cliente mínimo del protocolo Socket.io (v4) sobre el WebSocket de Node: así la prueba no necesita instalar nada.
const conectar = (puerto, cookie) => new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}/socket.io/?EIO=4&transport=websocket`, cookie ? { headers: { Cookie: cookie } } : undefined);
    const cliente = { ws, estado: 'conectando', error: null, mensajes: [], cerrado: false };
    ws.onmessage = (evento) => {
        const trama = String(evento.data);
        if (trama === '2') return ws.send('3');          // ping -> pong
        if (trama[0] === '0') return ws.send('40');      // el servidor abrió: pedimos el espacio de nombres
        if (trama.startsWith('40')) { cliente.estado = 'conectado'; return resolve(cliente); }
        if (trama.startsWith('44')) { cliente.estado = 'rechazado'; cliente.error = JSON.parse(trama.slice(2)).message; return resolve(cliente); }
        if (trama.startsWith('42')) { const [nombre, datos] = JSON.parse(trama.slice(2)); cliente.mensajes.push({ nombre, datos }); }
    };
    ws.onclose = () => { cliente.cerrado = true; };
});
const enviar = (cliente, datos) => cliente.ws.send('42' + JSON.stringify(['mensaje', datos]));
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const hasta = async (condicion, ms = 2000) => { const t = Date.now(); while (!condicion()) { if (Date.now() - t > ms) throw new Error('tiempo agotado esperando una respuesta'); await esperar(10); } };

const cookieDe = (payload, opciones = { expiresIn: '1h' }) => `jwtToken=${jwt.sign(payload, process.env.JWT_SECRET, opciones)}`;
const ALUMNA = { id: 7, name: 'Ana', rol: 'Alumno', tipoPerfil: 'Alumno' };
const OTRO = { id: 8, name: 'Beto', rol: 'Alumno', tipoPerfil: 'Alumno' };

const conChat = async (consultarIA, prueba) => {
    const servidor = http.createServer();
    const io = new Server(servidor);
    configurarChat(io, { consultarIA });
    await new Promise((r) => servidor.listen(0, r));
    const clientes = [];
    const nuevo = async (cookie) => { const c = await conectar(servidor.address().port, cookie); clientes.push(c); return c; };
    try {
        await prueba(nuevo);
    } finally {
        clientes.forEach((c) => c.ws.close());
        await io.close();
    }
};

test('no se puede chatear sin sesión: sin cookie, con token falso o vencido la conexión se rechaza', async () => {
    let llamadas = 0;
    await conChat(async () => { llamadas++; return 'x'; }, async (nuevo) => {
        assert.equal((await nuevo()).estado, 'rechazado');
        assert.equal((await nuevo('jwtToken=token.falso.xyz')).estado, 'rechazado');
        const firmadoConOtraClave = `jwtToken=${jwt.sign(ALUMNA, 'otra-clave')}`;
        assert.equal((await nuevo(firmadoConOtraClave)).estado, 'rechazado');
        const vencido = await nuevo(cookieDe(ALUMNA, { expiresIn: -10 }));
        assert.equal(vencido.estado, 'rechazado');
        assert.equal(vencido.error, 'Sesión inválida o vencida');
        assert.equal(llamadas, 0);
    });
});

test('la identidad sale de la sesión: un usuarioLogueado inventado por el navegador se ignora', async () => {
    const recibidos = [];
    await conChat(async (pregunta, rol, pantalla, historial, usuario) => { recibidos.push({ pregunta, rol, pantalla, usuario }); return 'Respuesta para Ana'; }, async (nuevo) => {
        const ana = await nuevo(cookieDe(ALUMNA));
        assert.equal(ana.estado, 'conectado');
        // Un alumno malintencionado se hace pasar por la alumna 999 y por Administrativo
        enviar(ana, { texto: '¿Qué notas tiene la alumna 999?', usuario: 'Otro', usuarioLogueado: { id: 999, rol: 'Administrativo', tipoPerfil: 'Personal' }, contexto: 'panel' });
        await hasta(() => ana.mensajes.length === 1);

        assert.equal(recibidos.length, 1);
        assert.equal(recibidos[0].usuario.id, 7);          // la de la sesión, no la 999
        assert.equal(recibidos[0].rol, 'Alumno');          // no "Administrativo"
        assert.equal(recibidos[0].pregunta, '¿Qué notas tiene la alumna 999?');
        assert.equal(recibidos[0].pantalla, 'panel');
        assert.deepEqual(ana.mensajes[0], { nombre: 'mensaje', datos: { usuario: 'Asesor Virtual', texto: 'Respuesta para Ana' } });
    });
});

test('la consulta es privada: la pregunta y la respuesta NO llegan a otras personas conectadas', async () => {
    await conChat(async (pregunta) => `Tus datos privados (${pregunta})`, async (nuevo) => {
        const ana = await nuevo(cookieDe(ALUMNA));
        const beto = await nuevo(cookieDe(OTRO));
        const admin = await nuevo(cookieDe({ id: 1, name: 'Admin', rol: 'Administrativo', tipoPerfil: 'Personal' }));

        enviar(ana, { texto: 'mis notas' });
        await hasta(() => ana.mensajes.length === 1);
        await esperar(200); // margen para detectar un envío indebido

        assert.equal(ana.mensajes.length, 1);
        assert.equal(beto.mensajes.length, 0);
        assert.equal(admin.mensajes.length, 0);

        // y la respuesta de Beto vuelve solo a Beto
        enviar(beto, { texto: 'mi situación' });
        await hasta(() => beto.mensajes.length === 1);
        await esperar(100);
        assert.equal(ana.mensajes.length, 1);
        assert.match(beto.mensajes[0].datos.texto, /mi situación/);
    });
});

test('mensajes vacíos se ignoran, los largos se recortan y el contexto inválido no rompe nada', async () => {
    const preguntas = [];
    await conChat(async (pregunta, rol, pantalla) => { preguntas.push({ pregunta, pantalla }); return 'ok'; }, async (nuevo) => {
        const ana = await nuevo(cookieDe(ALUMNA));
        enviar(ana, { texto: '   ' });
        enviar(ana, {});
        enviar(ana, { texto: 12345 });
        await esperar(150);
        assert.equal(preguntas.length, 0);

        enviar(ana, { texto: 'a'.repeat(MAX_CARACTERES_MENSAJE + 500), contexto: { raro: true } });
        await hasta(() => ana.mensajes.length === 1);
        assert.equal(preguntas[0].pregunta.length, MAX_CARACTERES_MENSAJE);
        assert.equal(preguntas[0].pantalla, 'sistema general');
    });
});

test('mientras el asistente responde, una segunda consulta recibe un aviso y no se duplica el trabajo', async () => {
    let liberar;
    const lenta = new Promise((r) => { liberar = r; });
    let llamadas = 0;
    await conChat(async () => { llamadas++; await lenta; return 'respuesta lenta'; }, async (nuevo) => {
        const ana = await nuevo(cookieDe(ALUMNA));
        enviar(ana, { texto: 'primera' });
        await hasta(() => llamadas === 1);
        enviar(ana, { texto: 'segunda' });
        await hasta(() => ana.mensajes.length === 1);
        assert.match(ana.mensajes[0].datos.texto, /Esperá un momento/);
        assert.equal(llamadas, 1);

        liberar();
        await hasta(() => ana.mensajes.length === 2);
        assert.equal(ana.mensajes[1].datos.texto, 'respuesta lenta');
    });
});

test('si el asistente falla, la persona recibe una disculpa y la pregunta no queda en el historial', async () => {
    mock.method(console, 'error', () => {});
    const historiales = [];
    let intento = 0;
    await conChat(async (pregunta, rol, pantalla, historial) => {
        historiales.push(historial.map((m) => m.parts[0].text));
        if (++intento === 1) throw new Error('el modelo no responde');
        return 'ahora sí';
    }, async (nuevo) => {
        const ana = await nuevo(cookieDe(ALUMNA));
        enviar(ana, { texto: 'primera' });
        await hasta(() => ana.mensajes.length === 1);
        assert.match(ana.mensajes[0].datos.texto, /Disculpá/);

        enviar(ana, { texto: 'segunda' });
        await hasta(() => ana.mensajes.length === 2);
        assert.deepEqual(historiales[1], ['segunda']); // la primera, que falló, no quedó
    });
    mock.restoreAll();
});

test('el historial de cada conexión está acotado y siempre arranca con una pregunta', async () => {
    const largos = [];
    await conChat(async (pregunta, rol, pantalla, historial) => {
        largos.push({ largo: historial.length, primero: historial[0].role });
        return 'r';
    }, async (nuevo) => {
        const ana = await nuevo(cookieDe(ALUMNA));
        for (let i = 1; i <= MAX_MENSAJES_HISTORIAL; i++) {
            enviar(ana, { texto: `pregunta ${i}` });
            await hasta(() => ana.mensajes.length === i);
        }
        assert.ok(largos.every((l) => l.largo <= MAX_MENSAJES_HISTORIAL + 1 && l.primero === 'user'));
    });
});
