import test from 'node:test';
import assert from 'node:assert/strict';
import { crearRespaldo, describirFallo } from '../services/respaldoIA.js';

const responde = (nombre, texto) => ({ nombre, consultar: async () => texto });
const falla = (nombre, mensaje, extra = {}) => ({ nombre, consultar: async () => { throw new Error(mensaje); }, ...extra });
// Un proveedor que anota en qué orden lo llamaron
const conRegistro = (registro, nombre, resultado, extra = {}) => ({
    nombre,
    consultar: async () => { registro.push(nombre); if (resultado instanceof Error) throw resultado; return resultado; },
    ...extra
});

test('respaldo de IA: se queda con el primer proveedor que responde y no molesta al siguiente', async () => {
    const llamados = [];
    const responder = crearRespaldo([conRegistro(llamados, 'A', 'Hola desde el modelo local'), conRegistro(llamados, 'B', 'no hacía falta')]);
    const resultado = await responder();
    assert.equal(resultado.texto, 'Hola desde el modelo local');
    assert.equal(resultado.proveedor, 'A');
    assert.deepEqual(resultado.fallos, []);
    assert.deepEqual(llamados, ['A']);
});

test('respaldo de IA: los argumentos llegan al proveedor, y si el primero falla responde el segundo y queda anotado por qué', async () => {
    const recibidos = [];
    const responder = crearRespaldo([
        falla('KoboldCpp', 'fetch failed'),
        { nombre: 'Gemini', consultar: async (...args) => { recibidos.push(args); return 'Hola desde Gemini'; } }
    ]);
    const resultado = await responder('la pregunta', ['historial']);
    assert.equal(resultado.texto, 'Hola desde Gemini');
    assert.equal(resultado.proveedor, 'Gemini');
    assert.deepEqual(resultado.fallos, ['KoboldCpp: fetch failed']);
    assert.deepEqual(recibidos, [['la pregunta', ['historial']]]);
});

test('respaldo de IA: si ninguno responde NO devuelve una disculpa: lanza un error que nombra a cada proveedor y su causa', async () => {
    const responder = crearRespaldo([falla('KoboldCpp', 'respondió 403: sin permiso'), falla('Gemini', '[503 Service Unavailable] demanda alta')]);
    await assert.rejects(responder(), (error) => {
        assert.match(error.message, /^Ningún proveedor de IA respondió\./);
        assert.match(error.message, /KoboldCpp: respondió 403: sin permiso/);
        assert.match(error.message, /Gemini: \[503 Service Unavailable\] demanda alta/);
        return true;
    });
});

test('respaldo de IA: una respuesta vacía o que no es texto cuenta como fallo, no como respuesta', async () => {
    const responder = crearRespaldo([responde('A', undefined), responde('B', '   '), responde('C', 'recién acá')]);
    const resultado = await responder();
    assert.equal(resultado.texto, 'recién acá');
    assert.equal(resultado.fallos.length, 2);
    assert.match(resultado.fallos[0], /respuesta vacía/);
});

test('respaldo de IA: si un modelo de Gemini está saturado (503) responde el siguiente modelo', async () => {
    const llamados = [];
    const responder = crearRespaldo([
        conRegistro(llamados, 'Gemini (flash)', new Error('[503 Service Unavailable] This model is currently experiencing high demand')),
        conRegistro(llamados, 'Gemini (flash-lite)', 'respuesta del modelo liviano')
    ]);
    const resultado = await responder();
    assert.equal(resultado.texto, 'respuesta del modelo liviano');
    assert.deepEqual(llamados, ['Gemini (flash)', 'Gemini (flash-lite)']);
});

test('respaldo de IA: un proveedor caído pasa al final de la fila un rato, así no demora cada pregunta, y después se lo vuelve a probar', async () => {
    let reloj = 0;
    const llamados = [];
    const kobold = conRegistro(llamados, 'KoboldCpp', new Error('fetch failed'), { pausaTrasFallarMs: 60000 });
    const responder = crearRespaldo([kobold, conRegistro(llamados, 'Gemini', 'ok')], { ahora: () => reloj });

    await responder();                                   // 1ª pregunta: prueba Kobold, falla, responde Gemini
    assert.deepEqual(llamados.splice(0), ['KoboldCpp', 'Gemini']);

    reloj = 30000;
    await responder();                                   // 2ª pregunta, a los 30 s: Kobold está en pausa, va directo a Gemini
    assert.deepEqual(llamados.splice(0), ['Gemini']);

    reloj = 61000;
    await responder();                                   // pasó el minuto: se lo vuelve a probar primero
    assert.deepEqual(llamados.splice(0), ['KoboldCpp', 'Gemini']);
});

test('respaldo de IA: un proveedor en pausa no se descarta: si los demás fallan se lo prueba por si ya volvió, y al responder sale de la pausa', async () => {
    let reloj = 0;
    let koboldVivo = false;
    let geminiVivo = true;
    const llamados = [];
    const kobold = { nombre: 'KoboldCpp', pausaTrasFallarMs: 60000, consultar: async () => { llamados.push('KoboldCpp'); if (!koboldVivo) throw new Error('apagado'); return 'desde Kobold'; } };
    const gemini = { nombre: 'Gemini', consultar: async () => { llamados.push('Gemini'); if (!geminiVivo) throw new Error('saturado'); return 'desde Gemini'; } };
    const responder = crearRespaldo([kobold, gemini], { ahora: () => reloj });

    await responder();                                   // Kobold falla y queda en pausa
    llamados.length = 0;

    reloj = 10000; geminiVivo = false; koboldVivo = true;
    const resultado = await responder();                 // Gemini falla y Kobold, aunque en pausa, ya volvió
    assert.equal(resultado.texto, 'desde Kobold');
    assert.deepEqual(llamados, ['Gemini', 'KoboldCpp']);

    llamados.length = 0; geminiVivo = true;
    await responder();                                   // al responder salió de la pausa: vuelve a ir primero
    assert.deepEqual(llamados, ['KoboldCpp']);
});

test('respaldo de IA: de un "fetch failed" se rescata el motivo real (equipo apagado, sin red, tiempo agotado)', () => {
    const sinConexion = new TypeError('fetch failed', { cause: Object.assign(new Error('connect ECONNREFUSED 10.0.0.5:5001'), { code: 'ECONNREFUSED' }) });
    assert.equal(describirFallo(sinConexion), 'fetch failed (ECONNREFUSED)');
    assert.equal(describirFallo(new Error('respondió 502: error desconocido')), 'respondió 502: error desconocido');
    assert.equal(describirFallo('texto suelto'), 'texto suelto');
    assert.ok(describirFallo(new Error('x'.repeat(1000))).length <= 301, 'un mensaje enorme se recorta para que el registro sea legible');
});
