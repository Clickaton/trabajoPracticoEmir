import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { describirError, prefiereJson, manejadorDeErrores, rutaNoEncontrada } from '../middlewares/errorHandler.js';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const NAVEGADOR = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,*/*;q=0.8';

test('describirError: traduce errores propios, de Mongoose y de Express', () => {
    assert.deepEqual(describirError(Object.assign(new Error('Faltan datos'), { status: 400 })), { status: 400, mensaje: 'Faltan datos' });
    assert.deepEqual(describirError(Object.assign(new Error('No existe'), { status: 404 })), { status: 404, mensaje: 'No existe' });

    const validacion = describirError({ name: 'ValidationError', errors: { a: { message: 'El nombre es obligatorio' }, b: { message: 'El año es inválido' } } });
    assert.equal(validacion.status, 400);
    assert.equal(validacion.mensaje, 'El nombre es obligatorio. El año es inválido');

    assert.equal(describirError({ name: 'CastError', path: 'id' }).status, 400);

    const duplicado = describirError({ code: 11000, keyValue: { dni: '123' } });
    assert.equal(duplicado.status, 409);
    assert.match(duplicado.mensaje, /dni/);

    assert.deepEqual(describirError({ type: 'entity.parse.failed', status: 400, message: 'Unexpected token' }),
        { status: 400, mensaje: 'El cuerpo de la solicitud no es un JSON válido' });
    assert.equal(describirError({ type: 'entity.too.large' }).status, 413);
});

test('describirError: un error inesperado es 500 y nunca muestra detalles internos', () => {
    const r = describirError(new Error('connection to cluster0.mongodb.net failed, password=abc123'));
    assert.equal(r.status, 500);
    assert.doesNotMatch(r.mensaje, /mongodb|password|abc123/);
    assert.equal(describirError(Object.assign(new Error('x'), { status: 'raro' })).status, 500);
    assert.equal(describirError(undefined).status, 500);
});

test('prefiereJson: fetch() pide JSON; el navegador, cuando navega, pide una página', () => {
    const pedido = (accept) => ({ accepts: (tipos) => {
        if (!accept) return tipos[0]; // sin Accept: el primero de la lista
        const partes = accept.split(',').map((p) => p.trim());
        for (const parte of partes) {
            const tipo = parte.split(';')[0];
            if (tipo === '*/*') return tipos[0];
            const encontrado = tipos.find((t) => tipo.endsWith('/' + t));
            if (encontrado) return encontrado;
        }
        return false;
    } });
    assert.equal(prefiereJson(pedido('application/json')), true);
    assert.equal(prefiereJson(pedido('*/*')), true);
    assert.equal(prefiereJson(pedido(undefined)), true);
    assert.equal(prefiereJson(pedido(NAVEGADOR)), false);
});

// ---- Con Express de verdad ----
const crearApp = () => {
    const app = express();
    app.set('view engine', 'pug');
    app.set('views', path.join(raiz, 'views'));
    app.use(express.json());
    app.get('/pide-datos', (req, res, next) => next(Object.assign(new Error('Faltan datos obligatorios'), { status: 400 })));
    app.get('/explota', () => { throw new Error('detalle interno: clave=1234'); });
    app.get('/explota-async', async () => { throw new Error('detalle interno async: clave=1234'); });
    app.get('/duplicado', (req, res, next) => next(Object.assign(new Error('E11000 duplicate key'), { code: 11000, keyValue: { legajo: 'L1' } })));
    app.post('/eco', (req, res) => res.json(req.body));
    app.use(rutaNoEncontrada);
    app.use(manejadorDeErrores);
    return app;
};

const conServidor = async (prueba) => {
    const servidor = crearApp().listen(0);
    await new Promise((r) => servidor.once('listening', r));
    try {
        await prueba(`http://127.0.0.1:${servidor.address().port}`);
    } finally {
        await new Promise((r) => servidor.close(r));
    }
};

test('un fetch() recibe SIEMPRE JSON, no una página HTML (el error "Unexpected token <")', async () => {
    mock.method(console, 'error', () => {});
    await conServidor(async (url) => {
        for (const accept of ['application/json', '*/*', undefined]) {
            const cabeceras = accept ? { Accept: accept } : {};
            for (const [ruta, status] of [['/pide-datos', 400], ['/no-existe', 404], ['/explota', 500], ['/explota-async', 500], ['/duplicado', 409]]) {
                const r = await fetch(url + ruta, { headers: cabeceras });
                assert.equal(r.status, status, `${ruta} (${accept})`);
                assert.match(r.headers.get('content-type'), /application\/json/, `${ruta} (${accept})`);
                const cuerpo = await r.json();
                assert.equal(typeof cuerpo.error, 'string');
                assert.equal(cuerpo.status, status);
            }
        }
        const r = await fetch(url + '/pide-datos', { headers: { Accept: 'application/json' } });
        assert.equal((await r.json()).error, 'Faltan datos obligatorios');
    });
    mock.restoreAll();
});

test('los errores 500 se registran en el servidor y no filtran detalles al cliente', async () => {
    const espia = mock.method(console, 'error', () => {});
    await conServidor(async (url) => {
        for (const ruta of ['/explota', '/explota-async']) {
            const r = await fetch(url + ruta, { headers: { Accept: 'application/json' } });
            const texto = await r.text();
            assert.doesNotMatch(texto, /clave=1234|detalle interno/);
        }
        const html = await (await fetch(url + '/explota', { headers: { Accept: NAVEGADOR } })).text();
        assert.doesNotMatch(html, /clave=1234|detalle interno/);
    });
    assert.ok(espia.mock.calls.length >= 3, 'cada 500 se registra en la consola del servidor');
    mock.restoreAll();
});

test('cuando se NAVEGA a una dirección, se muestra la página de error del instituto', async () => {
    await conServidor(async (url) => {
        const r = await fetch(url + '/no-existe', { headers: { Accept: NAVEGADOR } });
        assert.equal(r.status, 404);
        assert.match(r.headers.get('content-type'), /text\/html/);
        const html = await r.text();
        assert.match(html, /Ubicación no disponible/);

        const r400 = await fetch(url + '/pide-datos', { headers: { Accept: NAVEGADOR } });
        assert.equal(r400.status, 400);
        assert.match(await r400.text(), /Faltan datos obligatorios/);
    });
});

test('un cuerpo JSON mal formado responde 400 en JSON', async () => {
    await conServidor(async (url) => {
        const r = await fetch(url + '/eco', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: '{"a": ' });
        assert.equal(r.status, 400);
        assert.equal((await r.json()).error, 'El cuerpo de la solicitud no es un JSON válido');

        const ok = await fetch(url + '/eco', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"a":1}' });
        assert.deepEqual(await ok.json(), { a: 1 });
    });
});
