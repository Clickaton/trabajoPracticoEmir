// Tests de la lógica pura (sin base de datos). Se ejecutan con:  npm test
import test from 'node:test';
import assert from 'node:assert/strict';

import { ordenarMaterias, compararTexto } from '../utils/ordenarMaterias.js';
import {
    crearContexto, registroVigente, sumarMeses, evaluarRegularidad, estaAprobada, esPromocionCondicional,
    evaluarCorrelativasCursada, evaluarCorrelativasFinal, evaluarFinal, evaluarInscripcionCursada,
    proximoIntento, calcularSemaforo, semaforoAlumno, resumenMateria, resumenRegularidad, validarRegistroHistorial, validarResultadoFinal, estadoAcademicoDelAlumno
} from '../services/reglasAcademicasService.js';

const AHORA = new Date('2026-10-21T12:00:00');
const PLAN = { vencimientoRegularidadMeses: 24, maxLlamadosConsecutivos: 8, maxAusentes: null };
const MATERIAS = [
    { id: 1, nombre: 'Programación I', anio: 1 },
    { id: 2, nombre: 'Programación II', anio: 2 },
    { id: 3, nombre: 'Programación III', anio: 3 }
];
// Prog II exige Prog I Regular para cursar; Prog III exige Prog II Aprobada
const CORRELATIVAS = [
    { id: 1, materia_id: 2, requisito_id: 1, tipo_requisito: 'Regular' },
    { id: 2, materia_id: 3, requisito_id: 2, tipo_requisito: 'Aprobada' }
];

let contadorId = 100;
const reg = (materia_id, estado, extra = {}) => ({
    id: ++contadorId, alumno_id: 1, materia_id, estado, intento: 1, vigente: true,
    fechaRegularizacion: null, nota: null, motivoVencimiento: null, ...extra
});
const regular = (materia_id, desde, extra = {}) => reg(materia_id, 'Regular', { fechaRegularizacion: new Date(desde), ...extra });
const ctx = (historial, extra = {}) => crearContexto({ historial, correlativas: CORRELATIVAS, materias: MATERIAS, plan: PLAN, ahora: AHORA, ...extra });

// ---------------------------------------------------------------- orden (punto 7)
test('ordenarMaterias: por año y, dentro de cada año, por nombre (sin mezclar años)', () => {
    const lista = [
        { nombre: 'Sistemas Operativos', anio: 2 },
        { nombre: 'Álgebra', anio: 1 },
        { nombre: 'Programación III', anio: 3 },
        { nombre: 'Bases de Datos', anio: 2 },
        { nombre: 'Programación I', anio: 1 }
    ];
    const orden = ordenarMaterias(lista).map(m => m.nombre);
    assert.deepEqual(orden, ['Álgebra', 'Programación I', 'Bases de Datos', 'Sistemas Operativos', 'Programación III']);
    assert.equal(lista[0].nombre, 'Sistemas Operativos', 'no modifica la lista original');
});

test('ordenarMaterias: ignora tildes y mayúsculas, ordena números naturalmente y manda los años vacíos al final', () => {
    const lista = [{ nombre: 'zeta', anio: 1 }, { nombre: 'Álgebra', anio: 1 }, { nombre: 'Inglés 10', anio: 1 }, { nombre: 'Inglés 2', anio: 1 }, { nombre: 'Sin año', anio: null }];
    assert.deepEqual(ordenarMaterias(lista).map(m => m.nombre), ['Álgebra', 'Inglés 2', 'Inglés 10', 'zeta', 'Sin año']);
    assert.ok(compararTexto('Algebra', 'álgebra') === 0);
});

test('ordenarMaterias: acepta accesores y un criterio de grupo (plan)', () => {
    const filas = [{ materia: 'B', anio: 1, plan: 2 }, { materia: 'A', anio: 2, plan: 1 }, { materia: 'A', anio: 1, plan: 2 }];
    const orden = ordenarMaterias(filas, { grupo: f => f.plan, nombre: f => f.materia }).map(f => `${f.plan}-${f.anio}-${f.materia}`);
    assert.deepEqual(orden, ['1-2-A', '2-1-A', '2-1-B']);
});

// ---------------------------------------------------------------- fechas y registro vigente
test('sumarMeses: respeta fin de mes y años bisiestos', () => {
    assert.equal(sumarMeses(new Date('2024-01-31T12:00:00'), 1).getDate(), 29); // 29 de febrero de 2024
    assert.equal(sumarMeses(new Date('2026-03-15T12:00:00'), 24).toISOString().slice(0, 10), '2028-03-15');
});

test('registroVigente: ignora intentos anteriores y elige el mayor intento vigente', () => {
    const historial = [reg(1, 'Vencida', { intento: 1, vigente: false }), reg(1, 'Cursando', { intento: 2 }), reg(2, 'Regular')];
    assert.equal(registroVigente(historial, 1).intento, 2);
    assert.equal(registroVigente(historial, 99), null);
});

// ---------------------------------------------------------------- regularidad (puntos 2 y 11)
test('regularidad: vence a los meses del plan', () => {
    assert.deepEqual(
        [evaluarRegularidad(regular(1, '2024-09-01T12:00:00'), ctx([])).vigente, evaluarRegularidad(regular(1, '2024-09-01T12:00:00'), ctx([])).motivoPerdida],
        [false, 'Tiempo']
    );
    const vigente = evaluarRegularidad(regular(1, '2025-01-01T12:00:00'), ctx([]));
    assert.equal(vigente.vigente, true);
    assert.equal(vigente.vence.toISOString().slice(0, 10), '2027-01-01');
});

test('regularidad: el plan configura los meses y un Regular sin fecha se considera vigente', () => {
    const corto = crearContexto({ plan: { vencimientoRegularidadMeses: 6 }, ahora: AHORA });
    assert.equal(evaluarRegularidad(regular(1, '2026-01-01T12:00:00'), corto).vigente, false);
    const sinFecha = evaluarRegularidad(reg(1, 'Regular'), ctx([]));
    assert.equal(sinFecha.vigente, true);
    assert.equal(sinFecha.sinFecha, true);
});

// Helpers para armar finales de UNA cursada
const finalDe = (cursada, estado) => ({ historial_id: cursada.id, estado });

test('llamados: el Desaprobado y el Ausente CONSUMEN llamado; la inscripción Anulada y los finales de otra cursada no', () => {
    const cursada = regular(1, '2026-01-01T12:00:00');
    const plan = { vencimientoRegularidadMeses: 24, maxLlamadosConsecutivos: 3 };
    const conFinales = (...finales) => crearContexto({ historial: [cursada], plan, ahora: AHORA, intentosFinal: finales });

    const r = evaluarRegularidad(cursada, conFinales(finalDe(cursada, 'Desaprobado'), finalDe(cursada, 'Ausente'), finalDe(cursada, 'Anulada'), { historial_id: 9999, estado: 'Desaprobado' }));
    assert.equal(r.vigente, true);
    assert.equal(r.llamadosUsados, 2);
    assert.equal(r.llamadosRestantes, 1);
    assert.equal(r.ausentes, 1);

    const agotada = evaluarRegularidad(cursada, conFinales(finalDe(cursada, 'Desaprobado'), finalDe(cursada, 'Ausente'), finalDe(cursada, 'Ausente')));
    assert.equal(agotada.vigente, false);
    assert.equal(agotada.motivoPerdida, 'Llamados');
    assert.equal(agotada.llamadosRestantes, 0);
});

test('llamados: por defecto son 8 (también para un plan viejo sin el campo) y null significa sin tope', () => {
    const cursada = regular(1, '2026-01-01T12:00:00');
    const ocho = Array.from({ length: 8 }, () => finalDe(cursada, 'Desaprobado'));
    const siete = ocho.slice(0, 7);
    const evaluar = (plan, finales) => evaluarRegularidad(cursada, crearContexto({ historial: [cursada], plan, ahora: AHORA, intentosFinal: finales }));

    const planViejo = { vencimientoRegularidadMeses: 24 }; // sin maxLlamadosConsecutivos
    assert.equal(evaluar(planViejo, siete).vigente, true);
    assert.equal(evaluar(planViejo, siete).llamadosRestantes, 1);
    assert.equal(evaluar(planViejo, ocho).vigente, false);
    assert.equal(evaluar(planViejo, ocho).motivoPerdida, 'Llamados');
    assert.equal(evaluar(null, ocho).motivoPerdida, 'Llamados', 'sin plan también rige el 8');

    const sinTope = { vencimientoRegularidadMeses: 24, maxLlamadosConsecutivos: null };
    assert.equal(evaluar(sinTope, ocho).vigente, true);
    assert.equal(evaluar(sinTope, ocho).llamadosRestantes, null);
});

test('ausentes: el máximo es configurable por plan, el Ausente además consume llamado y por defecto no hay tope', () => {
    const cursada = regular(1, '2026-01-01T12:00:00');
    const evaluar = (maxAusentes, finales) => evaluarRegularidad(cursada, crearContexto({
        historial: [cursada], plan: { vencimientoRegularidadMeses: 24, maxLlamadosConsecutivos: 8, maxAusentes }, ahora: AHORA, intentosFinal: finales
    }));
    const tresAusentes = [finalDe(cursada, 'Ausente'), finalDe(cursada, 'Ausente'), finalDe(cursada, 'Ausente')];

    const conTopeTres = evaluar(3, tresAusentes);
    assert.equal(conTopeTres.vigente, false);
    assert.equal(conTopeTres.motivoPerdida, 'Ausentes');
    assert.equal(conTopeTres.llamadosUsados, 3, 'cada ausente también consumió un llamado');

    const dosDeTres = evaluar(3, tresAusentes.slice(0, 2));
    assert.equal(dosDeTres.vigente, true);
    assert.equal(dosDeTres.ausentesRestantes, 1);

    const conTopeCinco = evaluar(5, tresAusentes);
    assert.equal(conTopeCinco.vigente, true);
    assert.equal(conTopeCinco.ausentesRestantes, 2);

    const sinTope = evaluar(null, tresAusentes);
    assert.equal(sinTope.vigente, true);
    assert.equal(sinTope.ausentesRestantes, null);
});

test('ausentes: los Desaprobado no suman ausencias, y cuando se cumplen a la vez el motivo informado es Ausentes', () => {
    const cursada = regular(1, '2026-01-01T12:00:00');
    const ctxAusentes = (finales) => crearContexto({ historial: [cursada], plan: { maxLlamadosConsecutivos: 2, maxAusentes: 2 }, ahora: AHORA, intentosFinal: finales });

    const soloDesaprobados = evaluarRegularidad(cursada, ctxAusentes([finalDe(cursada, 'Desaprobado'), finalDe(cursada, 'Desaprobado')]));
    assert.equal(soloDesaprobados.ausentes, 0);
    assert.equal(soloDesaprobados.motivoPerdida, 'Llamados');

    const ambos = evaluarRegularidad(cursada, ctxAusentes([finalDe(cursada, 'Ausente'), finalDe(cursada, 'Ausente')]));
    assert.equal(ambos.motivoPerdida, 'Ausentes');
});

test('el tiempo gana si la regularidad ya había vencido, aunque no se hayan gastado llamados', () => {
    const vieja = regular(1, '2020-01-01T12:00:00');
    const r = evaluarRegularidad(vieja, crearContexto({ historial: [vieja], plan: PLAN, ahora: AHORA, intentosFinal: [] }));
    assert.equal(r.motivoPerdida, 'Tiempo');
});

test('perder la regularidad por llamados bloquea el final y habilita la recursada; el mensaje dice por qué', () => {
    const cursada = regular(2, '2026-01-01T12:00:00');
    const finales = Array.from({ length: 8 }, () => finalDe(cursada, 'Ausente'));
    const c = ctx([reg(1, 'Aprobada'), cursada], { intentosFinal: finales });

    const final = evaluarFinal(2, c);
    assert.equal(final.puede, false);
    assert.equal(final.motivos[0].codigo, 'REGULARIDAD_VENCIDA');
    assert.match(final.motivos[0].mensaje, /8 llamados/);

    const cursar = evaluarInscripcionCursada(2, c);
    assert.equal(cursar.recursada, true);
    assert.equal(cursar.proximoIntento, 2);
    assert.equal(calcularSemaforo(2, c).color, 'rojo');
});

test('perder la regularidad por ausentes: el mensaje menciona el máximo configurado', () => {
    const cursada = regular(2, '2026-01-01T12:00:00');
    const c = ctx([reg(1, 'Aprobada'), cursada], { plan: { vencimientoRegularidadMeses: 24, maxLlamadosConsecutivos: 8, maxAusentes: 3 }, intentosFinal: Array.from({ length: 3 }, () => finalDe(cursada, 'Ausente')) });
    assert.match(evaluarFinal(2, c).motivos[0].mensaje, /3 ausentes/);
});

// ---------------------------------------------------------------- llamados cronológicos: cuentan se anote o no el alumno
const llamado = (id, inicio, fin, extra = {}) => ({ id, tipo: 'Final', fechaInicio: inicio, horaInicio: '08:00', fechaFin: fin, horaFin: '20:00', ...extra });

test('llamados cronológicos: cada período de Final que pasó desde la regularización consume un llamado, aunque no se inscriba', () => {
    const cursada = regular(1, '2026-01-01T12:00:00');
    const plan = { vencimientoRegularidadMeses: null, maxLlamadosConsecutivos: 3 };
    const periodos = [
        llamado(1, '2025-12-01', '2025-12-10'),  // ANTES de regularizar: no cuenta
        llamado(2, '2026-03-01', '2026-03-10'),
        llamado(3, '2026-06-01', '2026-06-10'),
        llamado(4, '2026-10-20', '2026-11-05')   // todavía abierto (hoy es 21/10/2026): no se consumió
    ];
    const evaluar = (lista) => evaluarRegularidad(cursada, crearContexto({ historial: [cursada], plan, ahora: AHORA, periodosFinal: lista }));

    const dos = evaluar(periodos);
    assert.equal(dos.llamadosUsados, 2);
    assert.equal(dos.llamadosSinAnotarse, 2);
    assert.equal(dos.llamadosRestantes, 1);
    assert.equal(dos.vigente, true);

    const tres = evaluar([...periodos, llamado(5, '2026-09-01', '2026-09-10')]);
    assert.equal(tres.llamadosUsados, 3);
    assert.equal(tres.vigente, false);
    assert.equal(tres.motivoPerdida, 'Llamados');
});

test('llamados cronológicos: con 8 llamados por defecto y ~2,5 años se pierde la regularidad aunque nunca se haya anotado', () => {
    const cursada = regular(1, '2024-03-01T12:00:00');
    const periodos = [];
    for (let i = 0; i < 8; i++) {
        const mes = String(1 + i).padStart(2, '0');
        periodos.push(llamado(i + 1, `2025-${mes}-01`, `2025-${mes}-10`));
    }
    const c = crearContexto({ historial: [cursada], plan: { vencimientoRegularidadMeses: null }, ahora: AHORA, periodosFinal: periodos });
    const r = evaluarRegularidad(cursada, c);
    assert.equal(r.maxLlamados, 8);
    assert.equal(r.llamadosUsados, 8);
    assert.equal(r.motivoPerdida, 'Llamados');
    assert.equal(evaluarRegularidad(cursada, crearContexto({ historial: [cursada], plan: { vencimientoRegularidadMeses: null }, ahora: AHORA, periodosFinal: periodos.slice(0, 7) })).vigente, true);
});

test('llamados cronológicos: un llamado en el que el alumno se anotó no se cuenta dos veces; pendiente de resultado no se consume', () => {
    const cursada = regular(1, '2026-01-01T12:00:00');
    const plan = { vencimientoRegularidadMeses: null, maxLlamadosConsecutivos: 8 };
    const periodos = [llamado(2, '2026-03-01', '2026-03-10'), llamado(3, '2026-06-01', '2026-06-10'), llamado(4, '2026-09-01', '2026-09-10')];
    const finales = [
        { historial_id: cursada.id, periodo_id: 2, estado: 'Desaprobado' },  // se anotó y desaprobó: 1 llamado (no 2)
        { historial_id: cursada.id, periodo_id: 3, estado: 'Inscripto' }     // se anotó, falta cargar el resultado: todavía no consume
    ];
    const r = evaluarRegularidad(cursada, crearContexto({ historial: [cursada], plan, ahora: AHORA, periodosFinal: periodos, intentosFinal: finales }));
    assert.equal(r.llamadosUsados, 2, 'el desaprobado del período 2 + el período 4 al que no se anotó');
    assert.equal(r.llamadosSinAnotarse, 1);
    assert.equal(r.ausentes, 0);

    // si la inscripción se anula, ese llamado igual se consumió porque ya pasó
    const anulada = [{ historial_id: cursada.id, periodo_id: 3, estado: 'Anulada' }];
    const r2 = evaluarRegularidad(cursada, crearContexto({ historial: [cursada], plan, ahora: AHORA, periodosFinal: periodos, intentosFinal: anulada }));
    assert.equal(r2.llamadosUsados, 3);
});

test('llamados cronológicos: si hay fecha de examen, el llamado se consume ese día y no al cerrar la inscripción', () => {
    const cursada = regular(1, '2026-01-01T12:00:00');
    const plan = { vencimientoRegularidadMeses: null, maxLlamadosConsecutivos: 8 };
    const cerroPeroExamenFuturo = llamado(2, '2026-10-01', '2026-10-15', { fechaExamen: '2026-10-30' });
    const examenPasado = llamado(3, '2026-09-01', '2026-09-10', { fechaExamen: '2026-09-20' });
    const r = evaluarRegularidad(cursada, crearContexto({ historial: [cursada], plan, ahora: AHORA, periodosFinal: [cerroPeroExamenFuturo, examenPasado] }));
    assert.equal(r.llamadosUsados, 1);
});

test('llamados cronológicos: los ausentes siguen contándose solo por resultados Ausente (no por no anotarse)', () => {
    const cursada = regular(1, '2026-01-01T12:00:00');
    const plan = { vencimientoRegularidadMeses: null, maxLlamadosConsecutivos: 8, maxAusentes: 2 };
    const periodos = [llamado(2, '2026-03-01', '2026-03-10'), llamado(3, '2026-06-01', '2026-06-10'), llamado(4, '2026-09-01', '2026-09-10')];
    const sinAnotarse = evaluarRegularidad(cursada, crearContexto({ historial: [cursada], plan, ahora: AHORA, periodosFinal: periodos }));
    assert.equal(sinAnotarse.llamadosUsados, 3);
    assert.equal(sinAnotarse.ausentes, 0);
    assert.equal(sinAnotarse.vigente, true);

    const dosAusentes = [{ historial_id: cursada.id, periodo_id: 2, estado: 'Ausente' }, { historial_id: cursada.id, periodo_id: 3, estado: 'Ausente' }];
    const perdida = evaluarRegularidad(cursada, crearContexto({ historial: [cursada], plan, ahora: AHORA, periodosFinal: periodos, intentosFinal: dosAusentes }));
    assert.equal(perdida.motivoPerdida, 'Ausentes');
    assert.equal(perdida.llamadosUsados, 3);
});

test('llamados cronológicos: un Regular sin fecha de regularización solo cuenta los resultados cargados', () => {
    const sinFecha = reg(1, 'Regular');
    const periodos = [llamado(2, '2020-03-01', '2020-03-10'), llamado(3, '2021-06-01', '2021-06-10')];
    const r = evaluarRegularidad(sinFecha, crearContexto({ historial: [sinFecha], plan: { vencimientoRegularidadMeses: null, maxLlamadosConsecutivos: 2 }, ahora: AHORA, periodosFinal: periodos }));
    assert.equal(r.llamadosUsados, 0);
    assert.equal(r.vigente, true);
});

test('vencimiento por tiempo vacío (null): la regularidad no vence por tiempo, solo por llamados y ausentes', () => {
    const vieja = regular(1, '2018-01-01T12:00:00');
    const r = evaluarRegularidad(vieja, crearContexto({ historial: [vieja], plan: { vencimientoRegularidadMeses: null, maxLlamadosConsecutivos: null }, ahora: AHORA }));
    assert.equal(r.vigente, true);
    assert.equal(r.vence, null);
    // con el valor por defecto (plan viejo sin el campo) sigue venciendo a los 24 meses
    assert.equal(evaluarRegularidad(vieja, crearContexto({ historial: [vieja], plan: {}, ahora: AHORA })).motivoPerdida, 'Tiempo');
});

test('resumenMateria informa si la materia está efectivamente aprobada o es una promoción condicional', () => {
    const condicional = ctx([regular(1, '2026-01-01T12:00:00'), reg(2, 'Promocionada', { nota: 9 })]);
    assert.deepEqual([resumenMateria(2, condicional).aprobada, resumenMateria(2, condicional).condicional], [false, true]);
    const limpia = ctx([reg(1, 'Aprobada', { nota: 7 }), reg(2, 'Promocionada', { nota: 9 })]);
    assert.deepEqual([resumenMateria(2, limpia).aprobada, resumenMateria(2, limpia).condicional], [true, false]);
    assert.equal(resumenMateria(1, limpia).aprobada, true);
    assert.equal(resumenMateria(3, limpia).aprobada, false);
});

// ---------------------------------------------------------------- correlatividades para cursar
test('cursar: sin cursar la correlativa / cursando / regular vigente / regular vencida / aprobada', () => {
    const c = (h) => evaluarCorrelativasCursada(2, ctx(h));
    assert.equal(c([]).faltantes[0].codigo, 'SIN_CURSAR');
    assert.equal(c([reg(1, 'Cursando')]).faltantes[0].codigo, 'NO_REGULAR');
    assert.equal(c([regular(1, '2026-01-01T12:00:00')]).cumple, true);
    assert.equal(c([regular(1, '2020-01-01T12:00:00')]).faltantes[0].codigo, 'REGULARIDAD_VENCIDA');
    assert.equal(c([reg(1, 'Vencida')]).faltantes[0].codigo, 'REGULARIDAD_VENCIDA');
    assert.equal(c([reg(1, 'Aprobada', { nota: 8 })]).cumple, true);
    assert.equal(c([reg(1, 'Promocionada')]).cumple, true);
    assert.match(c([]).faltantes[0].mensaje, /Programación I/);
});

test('cursar con requisito "Aprobada": Regular no alcanza', () => {
    const c = (h) => evaluarCorrelativasCursada(3, ctx(h));
    assert.equal(c([regular(2, '2026-01-01T12:00:00')]).faltantes[0].codigo, 'NO_APROBADA');
    assert.equal(c([reg(2, 'Aprobada', { nota: 7 })]).cumple, true);
});

// ---------------------------------------------------------------- condicional (punto 4)
test('promoción condicional: Prog II promocionada con el final de Prog I pendiente', () => {
    const h = [regular(1, '2026-01-01T12:00:00'), reg(2, 'Promocionada', { nota: 9 })];
    assert.equal(esPromocionCondicional(2, ctx(h)), true);
    assert.equal(estaAprobada(2, ctx(h)), false);

    const sem = calcularSemaforo(2, ctx(h));
    assert.equal(sem.color, 'amarillo');
    assert.equal(sem.codigo, 'CONDICIONAL');
    assert.deepEqual(sem.pendientes, ['Programación I']);

    // Prog III exige Prog II Aprobada: una promoción condicional NO alcanza
    assert.equal(evaluarCorrelativasCursada(3, ctx(h)).faltantes[0].codigo, 'PROMOCION_CONDICIONAL');
});

test('promoción condicional: al aprobar el final de la correlativa pasa a verde y cuenta como aprobada', () => {
    const h = [reg(1, 'Aprobada', { nota: 7 }), reg(2, 'Promocionada', { nota: 9 })];
    assert.equal(esPromocionCondicional(2, ctx(h)), false);
    assert.equal(estaAprobada(2, ctx(h)), true);
    assert.equal(calcularSemaforo(2, ctx(h)).color, 'verde');
    assert.equal(evaluarCorrelativasCursada(3, ctx(h)).cumple, true);
});

test('promoción condicional en cadena: Prog III promocionada, Prog II promocionada y Prog I solo Regular', () => {
    const h = [regular(1, '2026-01-01T12:00:00'), reg(2, 'Promocionada'), reg(3, 'Promocionada')];
    assert.equal(calcularSemaforo(3, ctx(h)).color, 'amarillo');
    assert.equal(calcularSemaforo(2, ctx(h)).color, 'amarillo');
});

// ---------------------------------------------------------------- final (puntos 2 y 3)
test('final: Regular vigente con correlativas aprobadas puede rendir', () => {
    const h = [reg(1, 'Aprobada'), regular(2, '2026-01-01T12:00:00')];
    const r = evaluarFinal(2, ctx(h));
    assert.equal(r.puede, true);
    assert.deepEqual(r.motivos, []);
});

test('final: la correlativa tiene que tener el FINAL aprobado aunque la regla para cursar pida solo Regular', () => {
    const h = [regular(1, '2026-01-01T12:00:00'), regular(2, '2026-01-01T12:00:00')];
    const r = evaluarFinal(2, ctx(h));
    assert.equal(r.puede, false);
    assert.equal(r.motivos[0].codigo, 'NO_APROBADA');
    assert.equal(evaluarCorrelativasFinal(2, ctx(h)).cumple, false);
});

test('final: no puede rendir si venció la regularidad, está cursando, ya aprobó, promocionó o no cursó', () => {
    const base = [reg(1, 'Aprobada')];
    assert.equal(evaluarFinal(2, ctx([...base, regular(2, '2020-01-01T12:00:00')])).motivos[0].codigo, 'REGULARIDAD_VENCIDA');
    assert.equal(evaluarFinal(2, ctx([...base, reg(2, 'Cursando')])).motivos[0].codigo, 'CURSANDO');
    assert.equal(evaluarFinal(2, ctx([...base, reg(2, 'Aprobada')])).motivos[0].codigo, 'YA_APROBADA');
    assert.equal(evaluarFinal(2, ctx([...base, reg(2, 'Promocionada')])).motivos[0].codigo, 'PROMOCIONADA');
    assert.equal(evaluarFinal(2, ctx([...base, reg(2, 'Vencida')])).motivos[0].codigo, 'REGULARIDAD_VENCIDA');
    assert.equal(evaluarFinal(2, ctx(base)).motivos[0].codigo, 'SIN_CURSAR');
});

test('final: sin correlativas (Programación I) basta con estar Regular vigente', () => {
    assert.equal(evaluarFinal(1, ctx([regular(1, '2026-03-01T12:00:00')])).puede, true);
});

// ---------------------------------------------------------------- inscripción a cursada y recursada (punto 11)
test('inscripción a cursada: sin registro previo puede (intento 1) si cumple correlativas', () => {
    const r = evaluarInscripcionCursada(1, ctx([]));
    assert.equal(r.puede, true);
    assert.equal(r.recursada, false);
    assert.equal(r.proximoIntento, 1);
});

test('inscripción a cursada: se bloquea si ya cursa, ya la tiene Regular vigente o ya la aprobó/promocionó', () => {
    assert.equal(evaluarInscripcionCursada(1, ctx([reg(1, 'Cursando')])).bloqueo.codigo, 'YA_CURSANDO');
    assert.equal(evaluarInscripcionCursada(1, ctx([regular(1, '2026-01-01T12:00:00')])).bloqueo.codigo, 'REGULAR_VIGENTE');
    assert.equal(evaluarInscripcionCursada(1, ctx([reg(1, 'Aprobada')])).bloqueo.codigo, 'YA_APROBADA');
    assert.equal(evaluarInscripcionCursada(1, ctx([reg(1, 'Promocionada')])).bloqueo.codigo, 'YA_APROBADA');
});

test('recursada: con la regularidad vencida (o estado Vencida) puede volver a inscribirse y el intento sube', () => {
    const vencidaPorTiempo = evaluarInscripcionCursada(1, ctx([regular(1, '2020-01-01T12:00:00')]));
    assert.equal(vencidaPorTiempo.puede, true);
    assert.equal(vencidaPorTiempo.recursada, true);
    assert.equal(vencidaPorTiempo.proximoIntento, 2);

    const marcadaVencida = evaluarInscripcionCursada(1, ctx([reg(1, 'Vencida', { intento: 1 })]));
    assert.equal(marcadaVencida.recursada, true);
    assert.equal(marcadaVencida.puede, true);
});

test('recursada: el historial viejo no pisa al nuevo intento ni cuenta para las reglas', () => {
    const h = [reg(1, 'Vencida', { intento: 1, vigente: false }), reg(1, 'Cursando', { intento: 2 })];
    assert.equal(ctx(h).registro(1).intento, 2);
    assert.equal(proximoIntento(1, ctx(h)), 3);
    assert.equal(evaluarFinal(1, ctx(h)).motivos[0].codigo, 'CURSANDO');
    assert.equal(ctx(h).historialDe(1).length, 2, 'los dos intentos siguen registrados');
});

test('inscripción a cursada: además del estado propio, exige las correlativas', () => {
    const r = evaluarInscripcionCursada(2, ctx([]));
    assert.equal(r.puede, false);
    assert.equal(r.bloqueo, null);
    assert.equal(r.correlativas.faltantes[0].codigo, 'SIN_CURSAR');
});

// ---------------------------------------------------------------- semáforo (punto 4)
test('semáforo por materia', () => {
    assert.equal(calcularSemaforo(1, ctx([])).color, 'gris');
    assert.equal(calcularSemaforo(1, ctx([reg(1, 'Cursando')])).color, 'verde');
    assert.equal(calcularSemaforo(1, ctx([regular(1, '2026-01-01T12:00:00')])).color, 'verde');
    assert.equal(calcularSemaforo(1, ctx([regular(1, '2020-01-01T12:00:00')])).color, 'rojo');
    assert.equal(calcularSemaforo(1, ctx([reg(1, 'Vencida', { motivoVencimiento: 'Llamados' })])).color, 'rojo');
    assert.equal(calcularSemaforo(1, ctx([reg(1, 'Aprobada')])).color, 'verde');
});

test('semáforo del alumno: gana el peor color (rojo > amarillo > verde) y las "sin cursar" no cuentan', () => {
    const s = (...colores) => colores.map(color => ({ color }));
    assert.equal(semaforoAlumno(s('verde', 'amarillo', 'rojo', 'gris')).color, 'rojo');
    assert.equal(semaforoAlumno(s('verde', 'amarillo', 'gris')).color, 'amarillo');
    assert.equal(semaforoAlumno(s('verde', 'gris')).color, 'verde');
    assert.equal(semaforoAlumno(s('gris', 'gris')).color, 'gris');
    assert.equal(semaforoAlumno([]).color, 'gris');
    assert.deepEqual(semaforoAlumno(s('verde', 'verde', 'rojo', 'gris')).conteo, { verde: 2, amarillo: 0, rojo: 1 });
});

test('resumenMateria junta estado, regularidad, semáforo y si puede rendir final', () => {
    const h = [reg(1, 'Aprobada'), regular(2, '2026-01-01T12:00:00', { nota: 6, libro: '3', folio: '12' })];
    const r = resumenMateria(2, ctx(h));
    assert.equal(r.estado, 'Regular');
    assert.equal(r.regularidad.vigente, true);
    assert.equal(r.semaforo.color, 'verde');
    assert.equal(r.puedeRendirFinal, true);
    assert.equal(r.libro, '3');
    assert.equal(resumenMateria(3, ctx(h)).estado, 'Pendiente');
});

// ---------------------------------------------------------------------------
// Carga manual de registros del historial (acta, libro y folio, fechaRegularizacion)
// ---------------------------------------------------------------------------
const valida = (entrada, opciones = {}) => validarRegistroHistorial(entrada, { ahora: AHORA, ...opciones });

test('historial: el estado tiene que ser uno de los cinco válidos', () => {
    for (const estado of ['Cursando', 'Regular', 'Promocionada', 'Aprobada', 'Vencida']) {
        const nota = estado === 'Aprobada' ? { nota: 8, libro: '1', folio: '2' } : {};
        assert.ok(valida({ estado, ...nota }).datos, estado);
    }
    assert.ok(valida({ estado: 'Libre' }).error);
    assert.ok(valida({}).error);
});

test('historial: Cursando no lleva nota ni fechas; se limpian libro y folio', () => {
    assert.ok(valida({ estado: 'Cursando', nota: 7 }).error);
    const { datos } = valida({ estado: 'Cursando', libro: '4', folio: '5', fechaRegularizacion: '2026-03-01', fechaActa: '2026-03-02' });
    assert.equal(datos.nota, null);
    assert.equal(datos.libro, '');
    assert.equal(datos.fechaRegularizacion, null);
    assert.equal(datos.fechaActa, null);
});

test('historial: Regular sin fecha de regularización toma la de hoy; con fecha la respeta; no puede ser futura', () => {
    const hoy = valida({ estado: 'Regular' }).datos;
    assert.equal(hoy.fechaRegularizacion.getTime(), AHORA.getTime());

    const conFecha = valida({ estado: 'Regular', fechaRegularizacion: '2025-03-10' }).datos;
    assert.equal(conFecha.fechaRegularizacion.getFullYear(), 2025);
    assert.equal(conFecha.fechaRegularizacion.getMonth(), 2);
    assert.equal(conFecha.fechaRegularizacion.getDate(), 10);

    assert.ok(valida({ estado: 'Regular', fechaRegularizacion: '2026-12-01' }).error);
    assert.ok(valida({ estado: 'Regular', fechaRegularizacion: 'ayer' }).error);
});

test('historial: una fecha que ya viene de la base (Date) se respeta tal cual', () => {
    const original = new Date('2025-03-10T23:30:00-03:00');
    const { datos } = valida({ estado: 'Regular', fechaRegularizacion: original });
    assert.equal(datos.fechaRegularizacion, original);
});

test('historial: la nota es un entero de 1 a 10 y al cargarla se exigen libro y folio', () => {
    assert.ok(valida({ estado: 'Regular', nota: 0 }).error);
    assert.ok(valida({ estado: 'Regular', nota: 11 }).error);
    assert.ok(valida({ estado: 'Regular', nota: 6.5 }).error);
    assert.ok(valida({ estado: 'Regular', nota: 'siete' }).error);

    // sin pedir acta (corrección de otro dato de un registro viejo) la nota sola alcanza
    assert.equal(valida({ estado: 'Regular', nota: '7' }).datos.nota, 7);
    // cuando la nota se está cargando, libro y folio son obligatorios (ninguno de los dos puede faltar)
    assert.match(valida({ estado: 'Regular', nota: 7 }, { exigirActa: true }).error, /libro y el folio/);
    assert.match(valida({ estado: 'Regular', nota: 7, libro: '2' }, { exigirActa: true }).error, /libro y el folio/);
    assert.match(valida({ estado: 'Regular', nota: 7, folio: '9' }, { exigirActa: true }).error, /libro y el folio/);
    assert.equal(valida({ estado: 'Regular', nota: 7, libro: ' 2 ', folio: '9' }, { exigirActa: true }).datos.libro, '2');
    // sin nota no hace falta acta
    assert.ok(valida({ estado: 'Regular' }, { exigirActa: true }).datos);
});

test('historial: Aprobada exige nota de 4 a 10, libro y folio siempre; la fecha del acta por defecto es hoy', () => {
    assert.match(valida({ estado: 'Aprobada' }).error, /nota/);
    assert.match(valida({ estado: 'Aprobada', nota: 3, libro: '1', folio: '1' }).error, /mínima es 4/);
    assert.match(valida({ estado: 'Aprobada', nota: 8 }).error, /libro y el folio/);

    const { datos } = valida({ estado: 'Aprobada', nota: 4, libro: 'A-2', folio: '31' });
    assert.equal(datos.nota, 4);
    assert.equal(datos.libro, 'A-2');
    assert.equal(datos.folio, '31');
    assert.equal(datos.fechaActa.getTime(), AHORA.getTime());
});

test('historial: Aprobada no puede tener acta anterior a la regularización ni fechas futuras', () => {
    const base = { estado: 'Aprobada', nota: 8, libro: '1', folio: '1' };
    assert.ok(valida({ ...base, fechaRegularizacion: '2026-05-10', fechaActa: '2026-05-09' }).error);
    assert.ok(valida({ ...base, fechaRegularizacion: '2026-05-10', fechaActa: '2026-05-10' }).datos);
    assert.ok(valida({ ...base, fechaActa: '2027-01-01' }).error);
    assert.ok(valida({ ...base, fechaActa: 'xx' }).error);
});

test('historial: Promocionada con nota opcional pero de 4 o más', () => {
    assert.ok(valida({ estado: 'Promocionada' }).datos);
    assert.ok(valida({ estado: 'Promocionada', nota: 3 }).error);
    assert.equal(valida({ estado: 'Promocionada', nota: 9, libro: '1', folio: '1' }, { exigirActa: true }).datos.nota, 9);
});

test('historial: Vencida toma motivo Manual por defecto y solo acepta motivos conocidos; en otros estados no hay motivo', () => {
    assert.equal(valida({ estado: 'Vencida' }).datos.motivoVencimiento, 'Manual');
    assert.equal(valida({ estado: 'Vencida', motivoVencimiento: 'Ausentes' }).datos.motivoVencimiento, 'Ausentes');
    assert.ok(valida({ estado: 'Vencida', motivoVencimiento: 'Capricho' }).error);
    assert.equal(valida({ estado: 'Regular', motivoVencimiento: 'Tiempo' }).datos.motivoVencimiento, null);
});

test('resumenRegularidad: null si el registro no es Regular; si lo es, trae llamados y ausentes', () => {
    const c = ctx([regular(1, '2026-01-01T12:00:00')]);
    assert.equal(resumenRegularidad(evaluarRegularidad(reg(1, 'Aprobada'), c)), null);
    const resumen = resumenRegularidad(evaluarRegularidad(c.registro(1), c));
    assert.equal(resumen.vigente, true);
    assert.equal(resumen.maxLlamados, 8);
    assert.equal(resumen.llamadosRestantes, 8);
    assert.equal(resumen.ausentes, 0);
});

// ---------------------------------------------------------------------------
// Estado académico del alumno (ficha, dashboard, constancia, semáforo por cohorte)
// ---------------------------------------------------------------------------
test('estado académico: el porcentaje cuenta aprobadas y promocionadas sin deudas, no las condicionales', () => {
    // Prog I aprobada con final; Prog II promocionada y su correlativa (Prog I) tiene el final => cuenta.
    const sinDeudas = estadoAcademicoDelAlumno(MATERIAS, ctx([reg(1, 'Aprobada', { nota: 7 }), reg(2, 'Promocionada', { nota: 8 })]));
    assert.equal(sinDeudas.totalMaterias, 3);
    assert.equal(sinDeudas.materiasAprobadas, 2);
    assert.equal(sinDeudas.porcentaje, 67);

    // Prog III promocionada pero Prog II solo está regular (le falta el final) => condicional => no cuenta todavía.
    const conDeuda = estadoAcademicoDelAlumno(MATERIAS, ctx([
        reg(1, 'Aprobada', { nota: 7 }), regular(2, '2026-03-01T12:00:00'), reg(3, 'Promocionada', { nota: 9 })
    ]));
    assert.equal(conDeuda.materiasAprobadas, 1);
    assert.equal(conDeuda.porcentaje, 33);
});

test('estado académico: una promoción con final de correlativa pendiente es condicional (amarillo) y no suma', () => {
    // Prog III (promocionada) exige Prog II APROBADA con final; Prog II solo está promocionada y a su vez debe Prog I
    const h = [regular(1, '2026-03-01T12:00:00'), reg(2, 'Promocionada', { nota: 8 }), reg(3, 'Promocionada', { nota: 9 })];
    const e = estadoAcademicoDelAlumno(MATERIAS, ctx(h));
    const prog3 = e.materias.find(m => m.materia_id === 3);
    assert.equal(prog3.condicional, true);
    assert.equal(prog3.semaforo.color, 'amarillo');
    assert.equal(e.semaforo.color, 'amarillo');
    assert.ok(e.alertas.some(a => a.materia_id === 3 && a.color === 'amarillo'));
    assert.ok(e.materiasAprobadas < 3);
});

test('estado académico: al aprobar el final de la correlativa, la promoción condicional pasa a aprobada', () => {
    const h = [reg(1, 'Aprobada', { nota: 7 }), reg(2, 'Aprobada', { nota: 8 }), reg(3, 'Promocionada', { nota: 9 })];
    const e = estadoAcademicoDelAlumno(MATERIAS, ctx(h));
    assert.equal(e.materias.find(m => m.materia_id === 3).condicional, false);
    assert.equal(e.materiasAprobadas, 3);
    assert.equal(e.porcentaje, 100);
    assert.equal(e.semaforo.color, 'verde');
    assert.equal(e.alertas.length, 0);
});

test('estado académico: una cursada Regular con la regularidad perdida se muestra Vencida y pone al alumno en rojo', () => {
    const h = [regular(1, '2020-01-01T12:00:00'), reg(2, 'Cursando')];
    const e = estadoAcademicoDelAlumno(MATERIAS, ctx(h));
    const prog1 = e.materias.find(m => m.materia_id === 1);
    assert.equal(prog1.estado, 'Vencida');
    assert.equal(prog1.estadoRegistrado, 'Regular');
    assert.equal(prog1.semaforo.color, 'rojo');
    assert.equal(e.semaforo.color, 'rojo');
    assert.equal(e.semaforo.conteo.rojo, 1);
    assert.equal(e.alertas[0].codigo, 'REGULARIDAD_VENCIDA');
});

test('estado académico: un alumno sin registros está en gris, con 0% y sin alertas; un plan sin materias no divide por cero', () => {
    const vacioE = estadoAcademicoDelAlumno(MATERIAS, ctx([]));
    assert.equal(vacioE.semaforo.color, 'gris');
    assert.equal(vacioE.porcentaje, 0);
    assert.equal(vacioE.alertas.length, 0);
    assert.equal(vacioE.materias[0].estado, 'Pendiente');

    const sinMaterias = estadoAcademicoDelAlumno([], ctx([]));
    assert.equal(sinMaterias.porcentaje, 0);
    assert.equal(sinMaterias.totalMaterias, 0);
});

// ---------------------------------------------------------------------------
// Resultado de un final (punto 9: libro y folio del acta al cargar una nota)
// ---------------------------------------------------------------------------
test('resultado de final: Aprobado exige nota de 4 a 10, libro y folio', () => {
    assert.match(validarResultadoFinal({ resultado: 'Aprobado' }).error, /nota/);
    assert.match(validarResultadoFinal({ resultado: 'Aprobado', nota: 3, libro: '1', folio: '1' }).error, /4 o más/);
    assert.match(validarResultadoFinal({ resultado: 'Aprobado', nota: 11, libro: '1', folio: '1' }).error, /entre 1 y 10/);
    assert.match(validarResultadoFinal({ resultado: 'Aprobado', nota: 8 }).error, /libro y el folio/);
    assert.match(validarResultadoFinal({ resultado: 'Aprobado', nota: 8, libro: '2' }).error, /libro y el folio/);
    assert.match(validarResultadoFinal({ resultado: 'Aprobado', nota: 8, folio: '9' }).error, /libro y el folio/);

    const { datos } = validarResultadoFinal({ resultado: 'Aprobado', nota: '8', libro: ' B-2 ', folio: '31' });
    assert.deepEqual(datos, { resultado: 'Aprobado', nota: 8, libro: 'B-2', folio: '31' });
});

test('resultado de final: Desaprobado puede ir sin nota; con nota (1 a 3) también exige libro y folio', () => {
    assert.deepEqual(validarResultadoFinal({ resultado: 'Desaprobado' }).datos, { resultado: 'Desaprobado', nota: null, libro: '', folio: '' });
    assert.match(validarResultadoFinal({ resultado: 'Desaprobado', nota: 2 }).error, /libro y el folio/);
    assert.equal(validarResultadoFinal({ resultado: 'Desaprobado', nota: 2, libro: '1', folio: '5' }).datos.nota, 2);
    // con 4 o más el examen está aprobado: hay que marcarlo como Aprobado
    assert.match(validarResultadoFinal({ resultado: 'Desaprobado', nota: 4, libro: '1', folio: '5' }).error, /Aprobado/);
});

test('resultado de final: Ausente no lleva nota y el resultado tiene que ser uno de los tres conocidos', () => {
    assert.deepEqual(validarResultadoFinal({ resultado: 'Ausente' }).datos, { resultado: 'Ausente', nota: null, libro: '', folio: '' });
    assert.match(validarResultadoFinal({ resultado: 'Ausente', nota: 5 }).error, /no lleva nota/);
    assert.ok(validarResultadoFinal({ resultado: 'Pendiente' }).error);
    assert.ok(validarResultadoFinal({}).error);
    assert.ok(validarResultadoFinal().error);
});
