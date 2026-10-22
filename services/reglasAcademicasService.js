// Reglas académicas del instituto, como funciones PURAS (no acceden a la base de datos).
// Los controladores cargan los datos (historial, correlatividades, finales rendidos, plan) y se los pasan a
// crearContexto(). Después consultan acá si el alumno puede inscribirse, rendir un final, o en qué color de
// semáforo está. Como no tocan la base, se prueban con tests simples (ver tests/reglasAcademicas.test.js).

import { parseLocalDate, parseLocalDateTime } from '../utils/dateUtils.js';

export const ESTADOS = Object.freeze({
    CURSANDO: 'Cursando',
    REGULAR: 'Regular',
    PROMOCIONADA: 'Promocionada',
    APROBADA: 'Aprobada',
    VENCIDA: 'Vencida'
});

// Régimen del instituto: la cursada regular dura un número de LLAMADOS (turnos de final) desde que se regularizó
// (maxLlamadosConsecutivos del plan, 8 por defecto).
//   - Cada período de Final que pasa desde la regularización consume un llamado, SE INSCRIBA O NO el alumno.
//   - Un Desaprobado o un Ausente también consumen el llamado en el que ocurrieron.
//   - El Ausente además suma a la cuenta de ausencias (maxAusentes del plan): al llegar al máximo pierde la regularidad.
//   - Una inscripción Anulada no cuenta como haberse anotado (ese llamado igual se consume si ya pasó).
//   - Una inscripción todavía sin resultado (Inscripto) no consume el llamado hasta que se cargue el resultado.
export const ESTADOS_FINAL_QUE_CONSUMEN_LLAMADO = Object.freeze(['Desaprobado', 'Ausente']);
export const ESTADOS_FINAL_QUE_CUENTAN_COMO_AUSENCIA = Object.freeze(['Ausente']);

export const MESES_POR_DEFECTO = 24;
export const LLAMADOS_POR_DEFECTO = 8;

// Un tope válido es un entero positivo; cualquier otra cosa (null, vacío) significa "sin tope"
const topeONull = (valor) => (Number.isInteger(valor) && valor > 0 ? valor : null);

const porIntento = (a, b) => (a.intento ?? 1) - (b.intento ?? 1) || (a.id ?? 0) - (b.id ?? 0);

// Registro "actual" de una materia para el alumno: el vigente de mayor intento.
// Los intentos anteriores (vigente: false) quedan guardados como historia pero no cuentan para las reglas.
export const registroVigente = (historial, materiaId) => {
    const vigentes = historial.filter(h => h.materia_id === materiaId && h.vigente !== false).sort(porIntento);
    return vigentes.length ? vigentes[vigentes.length - 1] : null;
};

// Suma meses de calendario ("31 de enero + 1 mes" = "29 de febrero", no "3 de marzo")
export const sumarMeses = (fecha, meses) => {
    const resultado = new Date(fecha);
    const dia = resultado.getDate();
    resultado.setDate(1);
    resultado.setMonth(resultado.getMonth() + meses);
    const ultimoDiaDelMes = new Date(resultado.getFullYear(), resultado.getMonth() + 1, 0).getDate();
    resultado.setDate(Math.min(dia, ultimoDiaDelMes));
    return resultado;
};

/*
 * Arma el "contexto" con todo lo necesario para evaluar a UN alumno.
 *   historial:    registros de HistorialAcademico del alumno (todos los intentos)
 *   correlativas: reglas de correlatividad del plan (todas, de cualquier materia)
 *   intentosFinal: InscripcionFinal del alumno (resultados de finales: llamados consumidos y ausentes)
 *   periodosFinal: períodos de inscripción de tipo Final (cada uno que pasa consume un llamado, se anote o no el alumno)
 *   materias:     materias del plan (solo para mostrar nombres en los mensajes)
 *   plan:         PlanEstudio con vencimientoRegularidadMeses, maxLlamadosConsecutivos y maxAusentes
 *                 (un plan viejo sin esos campos usa 24 meses, 8 llamados y sin tope de ausentes;
 *                  vencimientoRegularidadMeses o maxLlamadosConsecutivos en null = sin ese límite)
 *   ahora:        fecha de referencia (se puede fijar en los tests)
 */
export const crearContexto = ({ historial = [], correlativas = [], intentosFinal = [], periodosFinal = [], materias = [], plan = null, ahora = new Date() } = {}) => {
    // Meses de vigencia de la regularidad: undefined = valor por defecto; null = sin vencimiento por tiempo (rigen solo los llamados)
    const meses = plan?.vencimientoRegularidadMeses === undefined ? MESES_POR_DEFECTO : topeONull(plan.vencimientoRegularidadMeses);
    // undefined = el plan todavía no tiene el campo (se creó antes de este régimen): rige el valor por defecto.
    // null = el instituto lo configuró explícitamente "sin tope".
    const maxLlamados = plan?.maxLlamadosConsecutivos === undefined ? LLAMADOS_POR_DEFECTO : topeONull(plan.maxLlamadosConsecutivos);
    const maxAusentes = topeONull(plan?.maxAusentes);

    const reglas = new Map();
    for (const c of correlativas) {
        if (!reglas.has(c.materia_id)) reglas.set(c.materia_id, []);
        reglas.get(c.materia_id).push(c);
    }

    const nombres = new Map(materias.map(m => [m.id, m.nombre]));

    const vigentes = new Map();
    for (const id of new Set(historial.map(h => h.materia_id))) {
        const actual = registroVigente(historial, id);
        if (actual) vigentes.set(id, actual);
    }

    return {
        ahora,
        meses,
        maxLlamados,
        maxAusentes,
        periodosFinal,
        registro: (materiaId) => vigentes.get(materiaId) ?? null,
        historialDe: (materiaId) => historial.filter(h => h.materia_id === materiaId).sort(porIntento),
        reglasDe: (materiaId) => reglas.get(materiaId) ?? [],
        // Finales de ESA cursada (los de cursadas anteriores no cuentan) sin contar las inscripciones anuladas
        intentosDe: (registro) => intentosFinal.filter(f => f.historial_id === registro.id && f.estado !== 'Anulada'),
        nombre: (materiaId) => nombres.get(materiaId) ?? `Materia #${materiaId}`
    };
};

const fechaCorta = (fecha) => new Date(fecha).toLocaleDateString('es-AR');

// ---------------------------------------------------------------------------
// Regularidad (punto 2 y 11): una materia Regular se pierde por lo que ocurra primero:
//   - Tiempo:    pasaron los meses del plan desde que se regularizó
//   - Ausentes:  alcanzó el máximo de ausentes a finales de esta cursada
//   - Llamados:  consumió los llamados permitidos (Desaprobado + Ausente) de esta cursada
// ---------------------------------------------------------------------------
// Último instante de un llamado: el día del examen si está cargado; si no, el cierre de la inscripción
const finDelLlamado = (periodo) => {
    if (periodo.fechaExamen) {
        const dia = parseLocalDate(periodo.fechaExamen);
        if (dia) { dia.setHours(23, 59, 59, 999); return dia; }
    }
    return parseLocalDateTime(periodo.fechaFin, periodo.horaFin);
};

export const evaluarRegularidad = (registro, ctx) => {
    if (!registro || registro.estado !== ESTADOS.REGULAR) return { aplica: false };

    const desde = registro.fechaRegularizacion ? new Date(registro.fechaRegularizacion) : null;
    const vence = desde && ctx.meses !== null ? sumarMeses(desde, ctx.meses) : null;

    // Finales de ESTA cursada: los resultados que consumen llamado + los llamados que pasaron sin que el alumno se anotara
    const finales = ctx.intentosDe(registro);
    const resueltos = finales.filter(f => ESTADOS_FINAL_QUE_CONSUMEN_LLAMADO.includes(f.estado)).length;
    const ausentes = finales.filter(f => ESTADOS_FINAL_QUE_CUENTAN_COMO_AUSENCIA.includes(f.estado)).length;

    // Un período donde el alumno tiene inscripción ya se contó arriba (o está pendiente de resultado): no se cuenta dos veces.
    // Un Regular sin fecha de regularización no permite saber desde cuándo contar: solo cuentan sus resultados cargados.
    let sinAnotarse = 0;
    if (desde) {
        const desdeDia = parseLocalDate(desde);
        const conRegistro = new Set(finales.map(f => f.periodo_id));
        for (const periodo of ctx.periodosFinal) {
            if (conRegistro.has(periodo.id)) continue;
            const inicio = parseLocalDate(periodo.fechaInicio);
            const fin = finDelLlamado(periodo);
            if (inicio && fin && inicio >= desdeDia && fin < ctx.ahora) sinAnotarse += 1;
        }
    }
    const llamadosUsados = resueltos + sinAnotarse;

    let motivoPerdida = null;
    if (vence && vence < ctx.ahora) motivoPerdida = 'Tiempo';
    else if (ctx.maxAusentes !== null && ausentes >= ctx.maxAusentes) motivoPerdida = 'Ausentes';
    else if (ctx.maxLlamados !== null && llamadosUsados >= ctx.maxLlamados) motivoPerdida = 'Llamados';

    return {
        aplica: true,
        vigente: motivoPerdida === null,
        vence,
        sinFecha: desde === null, // Regular sin fecha de regularización: se le da el beneficio de la duda
        maxLlamados: ctx.maxLlamados,
        llamadosUsados,
        llamadosSinAnotarse: sinAnotarse,
        llamadosRestantes: ctx.maxLlamados === null ? null : Math.max(ctx.maxLlamados - llamadosUsados, 0),
        maxAusentes: ctx.maxAusentes,
        ausentes,
        ausentesRestantes: ctx.maxAusentes === null ? null : Math.max(ctx.maxAusentes - ausentes, 0),
        motivoPerdida
    };
};

const mensajePerdida = (regularidad) => {
    switch (regularidad.motivoPerdida) {
        case 'Llamados':
            return `Pasaron los ${regularidad.maxLlamados} llamados de final desde que regularizaste la materia: tenés que volver a cursarla`;
        case 'Ausentes':
            return `Llegaste al máximo de ${regularidad.maxAusentes} ausentes a finales: tenés que volver a cursar la materia`;
        default:
            return `Se venció tu regularidad${regularidad.vence ? ` el ${fechaCorta(regularidad.vence)}` : ''}: tenés que volver a cursar la materia`;
    }
};

const SUFIJO_MOTIVO = {
    Tiempo: ' por tiempo',
    Llamados: ' por llamados agotados',
    Ausentes: ' por exceso de ausentes'
};

// ---------------------------------------------------------------------------
// Aprobación efectiva (punto 4). Una materia Promocionada es "condicional" mientras alguna de sus
// correlativas no tenga el final aprobado; recién cuando las aprueba cuenta como aprobada.
// ---------------------------------------------------------------------------
const esCondicionalRec = (materiaId, ctx, visitados) => {
    if (visitados.has(materiaId)) return true; // ciclo de correlatividades: no se puede asegurar
    const dentro = new Set(visitados).add(materiaId);
    return ctx.reglasDe(materiaId).some(regla => !estaAprobadaRec(regla.requisito_id, ctx, dentro));
};

const estaAprobadaRec = (materiaId, ctx, visitados) => {
    const registro = ctx.registro(materiaId);
    if (!registro) return false;
    if (registro.estado === ESTADOS.APROBADA) return true;
    if (registro.estado === ESTADOS.PROMOCIONADA) return !esCondicionalRec(materiaId, ctx, visitados);
    return false;
};

export const estaAprobada = (materiaId, ctx) => estaAprobadaRec(materiaId, ctx, new Set());

export const esPromocionCondicional = (materiaId, ctx) =>
    ctx.registro(materiaId)?.estado === ESTADOS.PROMOCIONADA && esCondicionalRec(materiaId, ctx, new Set());

const correlativasSinFinal = (materiaId, ctx) => ctx.reglasDe(materiaId)
    .filter(regla => !estaAprobadaRec(regla.requisito_id, ctx, new Set([materiaId])))
    .map(regla => ctx.nombre(regla.requisito_id));

// ---------------------------------------------------------------------------
// Correlatividades
// ---------------------------------------------------------------------------
const MENSAJES = {
    SIN_CURSAR: (n) => `Falta cursar "${n}"`,
    NO_REGULAR: (n) => `Debés tener Regular "${n}"`,
    REGULARIDAD_VENCIDA: (n) => `Se venció tu regularidad en "${n}": tenés que volver a cursarla`,
    NO_APROBADA: (n) => `Debés tener Aprobada "${n}" (con el final aprobado)`,
    PROMOCION_CONDICIONAL: (n) => `"${n}" está promocionada pero condicional: falta aprobar el final de sus correlativas`
};

// Devuelve null si el requisito se cumple, o el detalle de lo que falta
const incumplimiento = (requisitoId, exigido, ctx) => {
    const registro = ctx.registro(requisitoId);
    let codigo = null;

    if (!registro) {
        codigo = 'SIN_CURSAR';
    } else if (exigido === 'Aprobada') {
        if (!estaAprobada(requisitoId, ctx)) {
            codigo = registro.estado === ESTADOS.PROMOCIONADA ? 'PROMOCION_CONDICIONAL' : 'NO_APROBADA';
        }
    } else if (registro.estado === ESTADOS.VENCIDA) {
        codigo = 'REGULARIDAD_VENCIDA';
    } else if (registro.estado === ESTADOS.REGULAR) {
        // Un Regular cuya regularidad ya venció no sirve como requisito: hay que volver a cursarla
        if (!evaluarRegularidad(registro, ctx).vigente) codigo = 'REGULARIDAD_VENCIDA';
    } else if (registro.estado === ESTADOS.CURSANDO) {
        codigo = 'NO_REGULAR';
    }
    // Promocionada y Aprobada cumplen el requisito "Regular"

    if (!codigo) return null;
    const nombre = ctx.nombre(requisitoId);
    return { requisito_id: requisitoId, requisito: nombre, exigido, estadoActual: registro?.estado ?? null, codigo, mensaje: MENSAJES[codigo](nombre) };
};

// Para CURSAR: cada correlativa se evalúa con su propia condición (Regular o Aprobada)
export const evaluarCorrelativasCursada = (materiaId, ctx) => {
    const faltantes = ctx.reglasDe(materiaId)
        .map(regla => incumplimiento(regla.requisito_id, regla.tipo_requisito, ctx))
        .filter(Boolean);
    return { cumple: faltantes.length === 0, faltantes };
};

// Para rendir FINAL (punto 3): todas las correlativas con final aprobado, sin importar la condición cargada para cursar
export const evaluarCorrelativasFinal = (materiaId, ctx) => {
    const faltantes = ctx.reglasDe(materiaId)
        .map(regla => incumplimiento(regla.requisito_id, 'Aprobada', ctx))
        .filter(Boolean);
    return { cumple: faltantes.length === 0, faltantes };
};

// ---------------------------------------------------------------------------
// Final (puntos 2 y 3)
// ---------------------------------------------------------------------------
export const evaluarFinal = (materiaId, ctx) => {
    const registro = ctx.registro(materiaId);
    const motivos = [];
    let regularidad = { aplica: false };
    let correlativas = { cumple: true, faltantes: [] };

    if (!registro) {
        motivos.push({ codigo: 'SIN_CURSAR', mensaje: 'No tenés una cursada registrada en esta materia' });
    } else if (registro.estado === ESTADOS.APROBADA) {
        motivos.push({ codigo: 'YA_APROBADA', mensaje: 'Ya tenés aprobada esta materia' });
    } else if (registro.estado === ESTADOS.PROMOCIONADA) {
        motivos.push({ codigo: 'PROMOCIONADA', mensaje: 'La materia está promocionada: no se rinde final' });
    } else if (registro.estado === ESTADOS.CURSANDO) {
        motivos.push({ codigo: 'CURSANDO', mensaje: 'Todavía estás cursando la materia: primero tenés que regularizarla' });
    } else if (registro.estado === ESTADOS.VENCIDA) {
        motivos.push({ codigo: 'REGULARIDAD_VENCIDA', mensaje: 'Perdiste la regularidad: tenés que volver a cursar la materia' });
    } else {
        regularidad = evaluarRegularidad(registro, ctx);
        if (!regularidad.vigente) motivos.push({ codigo: 'REGULARIDAD_VENCIDA', mensaje: mensajePerdida(regularidad) });

        correlativas = evaluarCorrelativasFinal(materiaId, ctx);
        for (const f of correlativas.faltantes) {
            motivos.push({ codigo: f.codigo, mensaje: f.mensaje, requisito_id: f.requisito_id });
        }
    }

    return { puede: motivos.length === 0, motivos, regularidad, correlativas };
};

// ---------------------------------------------------------------------------
// Carga del resultado de un final (punto 9: libro y folio del acta al cargar una nota)
// ---------------------------------------------------------------------------
export const RESULTADOS_FINAL = Object.freeze(['Aprobado', 'Desaprobado', 'Ausente']);
// Escala 1 a 10: desde esta nota el examen está aprobado (supuesto estándar de los institutos superiores; ajustable acá)
export const NOTA_MINIMA_APROBACION = 4;

const vacio = (valor) => valor === undefined || valor === null || String(valor).trim() === '';

// Valida y normaliza lo que carga el administrativo. Devuelve { datos } o { error }.
//   Aprobado:    nota (4 a 10) + libro + folio obligatorios
//   Desaprobado: nota opcional (1 a 3); si la carga, libro y folio son obligatorios
//   Ausente:     sin nota; libro y folio opcionales
export const validarResultadoFinal = ({ resultado, nota, libro, folio } = {}) => {
    if (!RESULTADOS_FINAL.includes(resultado)) {
        return { error: `El resultado debe ser ${RESULTADOS_FINAL.join(', ')}` };
    }

    const libroLimpio = vacio(libro) ? '' : String(libro).trim();
    const folioLimpio = vacio(folio) ? '' : String(folio).trim();

    if (resultado === 'Ausente') {
        if (!vacio(nota)) return { error: 'Un ausente no lleva nota' };
        return { datos: { resultado, nota: null, libro: libroLimpio, folio: folioLimpio } };
    }

    let notaNumero = null;
    if (!vacio(nota)) {
        notaNumero = Number(nota);
        if (!Number.isInteger(notaNumero) || notaNumero < 1 || notaNumero > 10) {
            return { error: 'La nota debe ser un número entero entre 1 y 10' };
        }
    } else if (resultado === 'Aprobado') {
        return { error: 'Cargá la nota del examen' };
    }

    if (resultado === 'Aprobado' && notaNumero < NOTA_MINIMA_APROBACION) {
        return { error: `Para aprobar el final la nota debe ser ${NOTA_MINIMA_APROBACION} o más` };
    }
    if (resultado === 'Desaprobado' && notaNumero !== null && notaNumero >= NOTA_MINIMA_APROBACION) {
        return { error: `Con nota ${notaNumero} el final está aprobado: marcá el resultado como Aprobado` };
    }

    if (notaNumero !== null && (!libroLimpio || !folioLimpio)) {
        return { error: 'Al cargar una nota tenés que indicar también el libro y el folio del acta' };
    }

    return { datos: { resultado, nota: notaNumero, libro: libroLimpio, folio: folioLimpio } };
};

// ---------------------------------------------------------------------------
// Carga manual de un registro del historial (acta de cursada o de final cargada por un administrativo)
// ---------------------------------------------------------------------------
export const ESTADOS_HISTORIAL = Object.freeze(Object.values(ESTADOS));
export const MOTIVOS_VENCIMIENTO = Object.freeze(['Tiempo', 'Llamados', 'Ausentes', 'Manual']);

// Un Date ya viene de la base (se respeta tal cual, para no correrle el día a una fecha que no se tocó);
// un texto viene de un formulario ("AAAA-MM-DD") y se interpreta como fecha local.
const aFecha = (valor) => {
    if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
    return parseLocalDate(valor);
};

const mismoDiaOAnterior = (a, b) => new Date(a.getFullYear(), a.getMonth(), a.getDate()) <= new Date(b.getFullYear(), b.getMonth(), b.getDate());

// Valida y normaliza un registro del historial. Devuelve { datos } o { error }.
//   Cursando:     sin nota
//   Regular:      nota opcional (1 a 10); fechaRegularizacion obligatoria (si no viene, es hoy): de ella se cuenta el vencimiento
//   Promocionada: nota opcional (4 a 10)
//   Aprobada:     nota (4 a 10) + libro + folio obligatorios (acta del final)
//   Vencida:      motivo del vencimiento (por defecto 'Manual')
// Regla general (punto 9): si se carga una nota, el libro y el folio del acta son obligatorios.
//   exigirActa = true cuando la nota se está cargando o cambiando ahora; así un registro viejo con nota y sin libro
//   se puede seguir corrigiendo en otros campos (fechas, motivo) sin tener que inventar el libro.
export const validarRegistroHistorial = (entrada = {}, { exigirActa = false, ahora = new Date() } = {}) => {
    const { estado } = entrada;
    if (!ESTADOS_HISTORIAL.includes(estado)) {
        return { error: `El estado debe ser uno de: ${ESTADOS_HISTORIAL.join(', ')}` };
    }

    let nota = null;
    if (!vacio(entrada.nota)) {
        nota = Number(entrada.nota);
        if (!Number.isInteger(nota) || nota < 1 || nota > 10) return { error: 'La nota debe ser un número entero entre 1 y 10' };
    }

    if (estado === ESTADOS.CURSANDO && nota !== null) {
        return { error: 'Una materia que todavía se está cursando no lleva nota' };
    }
    if (estado === ESTADOS.APROBADA && nota === null) {
        return { error: 'Para dar la materia por aprobada cargá la nota del examen final' };
    }
    if ((estado === ESTADOS.APROBADA || estado === ESTADOS.PROMOCIONADA) && nota !== null && nota < NOTA_MINIMA_APROBACION) {
        return { error: `Con nota ${nota} la materia no está ${estado === ESTADOS.APROBADA ? 'aprobada' : 'promocionada'}: la nota mínima es ${NOTA_MINIMA_APROBACION}` };
    }

    const cursando = estado === ESTADOS.CURSANDO;
    const libro = cursando || vacio(entrada.libro) ? '' : String(entrada.libro).trim();
    const folio = cursando || vacio(entrada.folio) ? '' : String(entrada.folio).trim();
    if (nota !== null && (exigirActa || estado === ESTADOS.APROBADA) && (!libro || !folio)) {
        return { error: 'Al cargar una nota tenés que indicar también el libro y el folio del acta' };
    }

    const finDeHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59, 999);

    let fechaRegularizacion = null;
    if (!vacio(entrada.fechaRegularizacion)) {
        fechaRegularizacion = aFecha(entrada.fechaRegularizacion);
        if (!fechaRegularizacion) return { error: 'La fecha de regularización no es válida' };
        if (fechaRegularizacion > finDeHoy) return { error: 'La fecha de regularización no puede ser futura' };
    }
    if (cursando) fechaRegularizacion = null;
    else if (estado === ESTADOS.REGULAR && !fechaRegularizacion) fechaRegularizacion = new Date(ahora);

    let fechaActa = null;
    if (!cursando && !vacio(entrada.fechaActa)) {
        fechaActa = aFecha(entrada.fechaActa);
        if (!fechaActa) return { error: 'La fecha del acta no es válida' };
        if (fechaActa > finDeHoy) return { error: 'La fecha del acta no puede ser futura' };
    }
    if (estado === ESTADOS.APROBADA) {
        if (!fechaActa) fechaActa = new Date(ahora);
        if (fechaRegularizacion && !mismoDiaOAnterior(fechaRegularizacion, fechaActa)) {
            return { error: 'La fecha del acta no puede ser anterior a la fecha de regularización' };
        }
    }

    let motivoVencimiento = null;
    if (estado === ESTADOS.VENCIDA) {
        motivoVencimiento = vacio(entrada.motivoVencimiento) ? 'Manual' : entrada.motivoVencimiento;
        if (!MOTIVOS_VENCIMIENTO.includes(motivoVencimiento)) {
            return { error: `El motivo del vencimiento debe ser uno de: ${MOTIVOS_VENCIMIENTO.join(', ')}` };
        }
    }

    return { datos: { estado, nota, libro, folio, fechaActa, fechaRegularizacion, motivoVencimiento } };
};

// ---------------------------------------------------------------------------
// Inscripción a cursada y recursada (punto 11)
// ---------------------------------------------------------------------------
export const proximoIntento = (materiaId, ctx) =>
    ctx.historialDe(materiaId).reduce((maximo, h) => Math.max(maximo, h.intento ?? 1), 0) + 1;

export const evaluarInscripcionCursada = (materiaId, ctx) => {
    const registro = ctx.registro(materiaId);
    let bloqueo = null;
    let recursada = false;

    if (registro) {
        if (registro.estado === ESTADOS.VENCIDA) {
            recursada = true;
        } else if (registro.estado === ESTADOS.REGULAR) {
            if (evaluarRegularidad(registro, ctx).vigente) {
                bloqueo = { codigo: 'REGULAR_VIGENTE', mensaje: 'Ya tenés esta materia Regular: lo que corresponde es rendir el final' };
            } else {
                recursada = true; // la regularidad venció: puede volver a cursar
            }
        } else if (registro.estado === ESTADOS.CURSANDO) {
            bloqueo = { codigo: 'YA_CURSANDO', mensaje: 'Ya estás cursando esta materia' };
        } else {
            bloqueo = {
                codigo: 'YA_APROBADA',
                mensaje: registro.estado === ESTADOS.PROMOCIONADA ? 'Ya promocionaste esta materia' : 'Ya aprobaste esta materia'
            };
        }
    }

    const correlativas = evaluarCorrelativasCursada(materiaId, ctx);

    return {
        puede: bloqueo === null && correlativas.cumple,
        recursada,
        bloqueo,
        correlativas,
        proximoIntento: proximoIntento(materiaId, ctx)
    };
};

// ---------------------------------------------------------------------------
// Semáforo (punto 4): verde = al día, amarillo = condicional, rojo = perdió la regularidad, gris = sin cursar
// ---------------------------------------------------------------------------
export const calcularSemaforo = (materiaId, ctx) => {
    const registro = ctx.registro(materiaId);
    if (!registro) return { color: 'gris', codigo: 'SIN_CURSAR', mensaje: 'Sin cursar' };

    switch (registro.estado) {
        case ESTADOS.APROBADA:
            return { color: 'verde', codigo: 'APROBADA', mensaje: 'Aprobada' };

        case ESTADOS.PROMOCIONADA: {
            const pendientes = correlativasSinFinal(materiaId, ctx);
            if (pendientes.length > 0) {
                return {
                    color: 'amarillo',
                    codigo: 'CONDICIONAL',
                    mensaje: `Promocionada con condición: debe el final de ${pendientes.join(', ')}`,
                    pendientes
                };
            }
            return { color: 'verde', codigo: 'PROMOCIONADA', mensaje: 'Promocionada' };
        }

        case ESTADOS.REGULAR: {
            const regularidad = evaluarRegularidad(registro, ctx);
            if (!regularidad.vigente) {
                return { color: 'rojo', codigo: 'REGULARIDAD_VENCIDA', mensaje: mensajePerdida(regularidad) };
            }
            return {
                color: 'verde',
                codigo: 'REGULAR',
                mensaje: regularidad.vence ? `Regular (vence el ${fechaCorta(regularidad.vence)})` : 'Regular'
            };
        }

        case ESTADOS.VENCIDA: {
            const motivo = SUFIJO_MOTIVO[registro.motivoVencimiento] ?? '';
            return { color: 'rojo', codigo: 'VENCIDA', mensaje: `Regularidad vencida${motivo}: debe volver a cursar` };
        }

        default:
            return { color: 'verde', codigo: 'CURSANDO', mensaje: 'Cursando' };
    }
};

const GRAVEDAD = { gris: 0, verde: 1, amarillo: 2, rojo: 3 };

// Color global del alumno: el peor de sus materias (rojo > amarillo > verde). Las "sin cursar" no cuentan.
export const semaforoAlumno = (semaforos) => {
    const conteo = { verde: 0, amarillo: 0, rojo: 0 };
    let color = 'gris';

    for (const s of semaforos) {
        if (s.color !== 'gris') conteo[s.color] += 1;
        if (GRAVEDAD[s.color] > GRAVEDAD[color]) color = s.color;
    }
    return { color, conteo };
};

// Cómo va la regularidad de una cursada Regular, listo para mostrar (null si el registro no es Regular)
export const resumenRegularidad = (regularidad) => (regularidad?.aplica ? {
    vigente: regularidad.vigente,
    vence: regularidad.vence,
    motivoPerdida: regularidad.motivoPerdida,
    maxLlamados: regularidad.maxLlamados,
    llamadosUsados: regularidad.llamadosUsados,
    llamadosSinAnotarse: regularidad.llamadosSinAnotarse,
    llamadosRestantes: regularidad.llamadosRestantes,
    maxAusentes: regularidad.maxAusentes,
    ausentes: regularidad.ausentes,
    ausentesRestantes: regularidad.ausentesRestantes
} : null);

// Resumen de una materia para mostrar en pantallas y APIs
export const resumenMateria = (materiaId, ctx) => {
    const registro = ctx.registro(materiaId);
    const regularidad = evaluarRegularidad(registro, ctx);

    return {
        materia_id: materiaId,
        estado: registro ? registro.estado : 'Pendiente',
        aprobada: estaAprobada(materiaId, ctx),               // Aprobada, o Promocionada sin finales pendientes de sus correlativas
        condicional: esPromocionCondicional(materiaId, ctx),  // Promocionada con algún final de correlativa pendiente
        nota: registro?.nota ?? null,
        intento: registro?.intento ?? null,
        libro: registro?.libro || '',
        folio: registro?.folio || '',
        regularidad: resumenRegularidad(regularidad),
        semaforo: calcularSemaforo(materiaId, ctx),
        puedeRendirFinal: evaluarFinal(materiaId, ctx).puede
    };
};

// ---------------------------------------------------------------------------
// Estado académico completo de un alumno sobre las materias de su plan (ficha, dashboard, semáforo por cohorte)
// ---------------------------------------------------------------------------
export const estadoAcademicoDelAlumno = (materias, ctx) => {
    const resumenes = materias.map(materia => {
        const resumen = resumenMateria(materia.id, ctx);
        // Una cursada Regular cuya regularidad ya se perdió (tiempo, llamados o ausentes) se muestra como Vencida
        // aunque en la base siga guardada como Regular (el vencimiento se calcula, no se guarda)
        const perdioLaRegularidad = resumen.estado === ESTADOS.REGULAR && resumen.regularidad && !resumen.regularidad.vigente;

        return {
            ...resumen,
            nombre: materia.nombre,
            anio: materia.anio,
            estadoRegistrado: resumen.estado,
            estado: perdioLaRegularidad ? ESTADOS.VENCIDA : resumen.estado
        };
    });

    const totalMaterias = materias.length;
    // El porcentaje cuenta las aprobadas y las promocionadas que ya no deben ningún final de sus correlativas
    const materiasAprobadas = resumenes.filter(r => r.aprobada).length;
    const { color, conteo } = semaforoAlumno(resumenes.map(r => r.semaforo));

    return {
        materias: resumenes,
        totalMaterias,
        materiasAprobadas,
        porcentaje: totalMaterias > 0 ? Math.round((materiasAprobadas / totalMaterias) * 100) : 0,
        semaforo: { color, conteo },
        // Lo que requiere atención: regularidad perdida (rojo) o promoción condicional (amarillo)
        alertas: resumenes
            .filter(r => r.semaforo.color === 'rojo' || r.semaforo.color === 'amarillo')
            .map(r => ({
                materia_id: r.materia_id,
                nombre: r.nombre,
                anio: r.anio,
                color: r.semaforo.color,
                codigo: r.semaforo.codigo,
                mensaje: r.semaforo.mensaje
            }))
    };
};

