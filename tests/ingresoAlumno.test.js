// Tests de los datos de ingreso del alumno (tipo de ingreso y pase). Se ejecutan con:  npm test
import test from 'node:test';
import assert from 'node:assert/strict';

import { TIPOS_INGRESO, traeDatosDeIngreso, validarDatosIngreso } from '../utils/ingresoAlumno.js';

const AHORA = new Date('2026-10-21T12:00:00');
const valida = (cuerpo, opciones = {}) => validarDatosIngreso(cuerpo, { ahora: AHORA, ...opciones });

test('ingreso: los tipos válidos son Inicial, Ingreso a 2do e Ingreso a 3ro', () => {
    assert.deepEqual([...TIPOS_INGRESO], ['Inicial', 'Ingreso a 2do', 'Ingreso a 3ro']);
    for (const tipo of TIPOS_INGRESO) assert.equal(valida({ tipoIngreso: tipo }).datos.tipoIngreso, tipo);
    assert.equal(valida({ tipoIngreso: '  Ingreso a 2do ' }).datos.tipoIngreso, 'Ingreso a 2do');
    assert.match(valida({ tipoIngreso: 'Libre' }).error, /tipo de ingreso/);
});

test('ingreso: sin datos de ingreso no se devuelve nada (al crear rigen los valores por defecto)', () => {
    assert.deepEqual(valida({}).datos, {});
    assert.deepEqual(valida({ tipoIngreso: '' }).datos, {});
    assert.equal(traeDatosDeIngreso({ name: 'Ana' }), false);
    assert.equal(traeDatosDeIngreso({ tipoIngreso: 'Inicial' }), true);
    assert.equal(traeDatosDeIngreso({ esPase: 'on' }), true);
    assert.equal(traeDatosDeIngreso({ pase: { esPase: true } }), true);
});

test('pase: si es pase, el instituto de origen es obligatorio', () => {
    assert.match(valida({ pase: { esPase: true } }).error, /instituto de origen/);
    assert.match(valida({ esPase: 'true', institutoOrigen: '   ' }).error, /instituto de origen/);

    const { datos } = valida({ pase: { esPase: true, institutoOrigen: ' ISFT 177 ', observaciones: 'Equivalencias pendientes' } });
    assert.deepEqual(datos.pase, { esPase: true, institutoOrigen: 'ISFT 177', fechaPase: null, observaciones: 'Equivalencias pendientes' });
});

test('pase: acepta los datos planos del formulario y deduce que es pase si hay instituto aunque falte la casilla', () => {
    const conCasilla = valida({ esPase: 'on', institutoOrigen: 'ISFT 177', fechaPase: '2026-02-15', observacionesPase: 'ok' }).datos.pase;
    assert.equal(conCasilla.esPase, true);
    assert.equal(conCasilla.fechaPase.getMonth(), 1);
    assert.equal(conCasilla.fechaPase.getDate(), 15);
    assert.equal(conCasilla.observaciones, 'ok');

    const sinCasilla = valida({ institutoOrigen: 'ISFT 177' }).datos.pase;
    assert.equal(sinCasilla.esPase, true);
});

test('pase: si no es pase se limpian el resto de los datos del pase', () => {
    const esperado = { esPase: false, institutoOrigen: '', fechaPase: null, observaciones: '' };
    assert.deepEqual(valida({ pase: { esPase: false, institutoOrigen: 'ISFT 177' } }).datos.pase, esperado);
    assert.deepEqual(valida({ esPase: 'false' }).datos.pase, esperado);
    assert.deepEqual(valida({ esPase: '', institutoOrigen: '' }).datos.pase, esperado);
    assert.deepEqual(valida({ pase: null }).datos.pase, esperado);
});

test('pase: la fecha tiene que ser válida y no futura', () => {
    assert.match(valida({ pase: { esPase: true, institutoOrigen: 'X', fechaPase: 'mañana' } }).error, /fecha del pase no es válida/);
    assert.match(valida({ pase: { esPase: true, institutoOrigen: 'X', fechaPase: '2027-01-01' } }).error, /futura/);
    assert.ok(valida({ pase: { esPase: true, institutoOrigen: 'X', fechaPase: '2026-10-21' } }).datos);
});

test('pase: al editar se puede corregir un solo dato sin reenviar los demás', () => {
    const actual = { pase: { esPase: true, institutoOrigen: 'ISFT 177', fechaPase: new Date('2026-02-15T12:00:00'), observaciones: 'a' } };

    const cambioObs = valida({ observacionesPase: 'b' }, { actual }).datos.pase;
    assert.equal(cambioObs.institutoOrigen, 'ISFT 177');
    assert.equal(cambioObs.fechaPase.getTime(), actual.pase.fechaPase.getTime()); // la fecha guardada no se mueve
    assert.equal(cambioObs.observaciones, 'b');

    // borrar el instituto de un pase deja el dato incompleto
    assert.match(valida({ institutoOrigen: '' }, { actual }).error, /instituto de origen/);
    // marcar "no es pase" lo limpia todo
    assert.equal(valida({ esPase: false }, { actual }).datos.pase.institutoOrigen, '');
    // un alumno que no venía por pase no pasa a serlo sin instituto
    assert.equal(valida({ observacionesPase: 'x' }, { actual: { pase: { esPase: false } } }).datos.pase.esPase, false);
});

test('pase: un valor que no es objeto se rechaza', () => {
    assert.match(valida({ pase: 'si' }).error, /objeto/);
});
