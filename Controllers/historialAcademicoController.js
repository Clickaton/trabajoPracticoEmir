// Historial académico: consulta y carga manual de registros por los administrativos (actas de cursada y de final).
// Las reglas (estados, notas, libro y folio, fechas) viven en reglasAcademicasService; acá solo se lee y se escribe en la base.
import HistorialAcademico from '../models/HistorialAcademico.js';
import Alumno from '../models/Alumno.js';
import Materia from '../models/Materia.js';
import Cohorte from '../models/Cohorte.js';
import Inscripcion from '../models/Inscripcion.js';
import InscripcionFinal from '../models/InscripcionFinal.js';
import { ordenarMaterias } from '../utils/ordenarMaterias.js';
import { siguienteId } from '../utils/siguienteId.js';
import { parseLocalDate } from '../utils/dateUtils.js';
import { obtenerPlanDeAlumno } from '../services/planService.js';
import { cargarContextoAcademico } from '../services/contextoAcademicoService.js';
import {
    ESTADOS, evaluarRegularidad, registroVigente, resumenRegularidad, validarRegistroHistorial
} from '../services/reglasAcademicasService.js';

const MAX_REGISTROS_POR_CARGA = 200;

const vacio = (valor) => valor === undefined || valor === null || String(valor).trim() === '';
const entero = (valor) => {
    if (vacio(valor)) return null;
    const numero = Number(valor);
    return Number.isInteger(numero) && numero > 0 ? numero : null;
};
const verdadero = (valor) => valor === true || valor === 1 || ['true', '1', 'si', 'sí'].includes(String(valor).toLowerCase());

const mismoDia = (a, b) => {
    const x = parseLocalDate(a);
    const y = parseLocalDate(b);
    return !!x && !!y && x.toDateString() === y.toDateString();
};

// Un registro como lo muestran las pantallas
const filaDeRegistro = (registro, materia) => ({
    id_registro: registro.id,
    materia_id: registro.materia_id,
    materia: materia ? materia.nombre : 'Materia Desconocida',
    anio: materia ? materia.anio : null,
    estado: registro.estado,
    nota: registro.nota ?? null,
    intento: registro.intento ?? 1,
    vigente: registro.vigente !== false,
    libro: registro.libro || '',
    folio: registro.folio || '',
    fechaActa: registro.fechaActa ?? null,
    fechaRegularizacion: registro.fechaRegularizacion ?? null,
    motivoVencimiento: registro.motivoVencimiento ?? null
});

// Por año, luego por nombre y, para una materia recursada, por número de intento
const ordenarFilas = (filas) => ordenarMaterias(
    [...filas].sort((a, b) => a.intento - b.intento),
    { nombre: (fila) => fila.materia }
);

// Al regularizar, promocionar o aprobar una materia, la inscripción a cursada deja de estar pendiente
// (se borra la más reciente: es la de la cursada que se acaba de cerrar)
const cerrarInscripcionDeCursada = async (alumnoId, materiaId) => {
    const pendientes = await Inscripcion.find({ alumno_id: alumnoId, materia_id: materiaId }).lean();
    if (pendientes.length === 0) return;
    const ultima = pendientes.reduce((mayor, i) => (i.id > mayor.id ? i : mayor));
    await Inscripcion.findOneAndDelete({ id: ultima.id });
};

// Cómo queda la regularidad con los datos recién cargados: si la fecha de regularización es vieja,
// la cursada puede nacer ya vencida y conviene que el administrativo lo vea en el momento.
const regularidadDespuesDeGuardar = async (registro) => {
    if (registro.estado !== ESTADOS.REGULAR) return { regularidad: null, aviso: null };

    try {
        const alumno = await Alumno.findOne({ id: registro.alumno_id }).lean();
        if (!alumno) return { regularidad: null, aviso: null };

        const { ctx } = await cargarContextoAcademico(alumno);
        const evaluada = evaluarRegularidad(registro, ctx);
        const motivo = { Tiempo: 'ya pasó el plazo de vigencia', Llamados: 'ya se usaron todos los llamados', Ausentes: 'alcanzó el máximo de ausentes' }[evaluada.motivoPerdida];

        return {
            regularidad: resumenRegularidad(evaluada),
            aviso: evaluada.aplica && !evaluada.vigente
                ? `Atención: con estos datos la regularidad no está vigente (${motivo}): el alumno tendría que volver a cursar la materia`
                : null
        };
    } catch (error) {
        console.error('[historial] No se pudo evaluar la regularidad:', error);
        return { regularidad: null, aviso: null };
    }
};

// ---------------------------------------------------------------------------
// GET /api/historial  (administrativos)
// Todos los alumnos con registros, agrupados. ?soloVigentes=true oculta los intentos anteriores de materias recursadas.
// ---------------------------------------------------------------------------
export const getHistorial = async (req, res) => {
    try {
        const soloVigentes = verdadero(req.query?.soloVigentes);
        const [lista, alumnos, materias, cohortes] = await Promise.all([
            HistorialAcademico.find().lean(),
            Alumno.find().lean(),
            Materia.find().lean(),
            Cohorte.find().lean()
        ]);

        const materiaPorId = new Map(materias.map(m => [m.id, m]));
        const cohortePorId = new Map(cohortes.map(c => [c.id, c]));

        const historialAgrupado = alumnos.map(alumno => {
            const cohorte = alumno.cohorte_id ? cohortePorId.get(alumno.cohorte_id) : null;

            const registros = ordenarFilas(
                lista
                    .filter(r => r.alumno_id === alumno.id && (!soloVigentes || r.vigente !== false))
                    .map(r => filaDeRegistro(r, materiaPorId.get(r.materia_id)))
            );

            return {
                alumno_id: alumno.id,
                alumno: alumno.name,
                cohorte: cohorte ? cohorte.name : "Sin Cohorte Asignada",
                registros
            };
        });

        // Solo se muestran los alumnos que tienen al menos un registro
        res.json({ message: 'Historial Académico Global', data: historialAgrupado.filter(h => h.registros.length > 0) });
    } catch (error) {
        console.error('[historial] getHistorial:', error);
        res.status(500).json({ error: "Error obteniendo el historial global" });
    }
};

// ---------------------------------------------------------------------------
// GET /api/historial/alumno/:alumnoId  (el propio alumno o un administrativo)
// Incluye, para las cursadas Regulares vigentes, cuántos llamados y ausentes le quedan y cuándo vence.
// ---------------------------------------------------------------------------
export const getHistorialByAlumno = async (req, res) => {
    try {
        const alumnoId = entero(req.params.alumnoId);
        if (!alumnoId) return res.status(400).json({ error: "El alumno indicado no es válido" });

        const registros = await HistorialAcademico.find({ alumno_id: alumnoId }).lean();
        if (registros.length === 0) {
            return res.status(404).json({ error: `No se encontró historial para el alumno ID: ${alumnoId}` });
        }

        const alumno = await Alumno.findOne({ id: alumnoId }).lean();
        const cohorte = alumno?.cohorte_id ? await Cohorte.findOne({ id: alumno.cohorte_id }).lean() : null;
        const materias = await Materia.find({ id: { $in: [...new Set(registros.map(r => r.materia_id))] } }).lean();
        const materiaPorId = new Map(materias.map(m => [m.id, m]));
        const contexto = alumno ? (await cargarContextoAcademico(alumno)).ctx : null;

        const filas = registros.map(r => ({
            ...filaDeRegistro(r, materiaPorId.get(r.materia_id)),
            alumno: alumno ? alumno.name : "Alumno Desconocido",
            cohorte: cohorte ? cohorte.name : "Sin Cohorte Asignada",
            // Solo la cursada vigente puede estar Regular "en curso"; los intentos anteriores ya son historia
            regularidad: contexto && r.vigente !== false ? resumenRegularidad(evaluarRegularidad(r, contexto)) : null
        }));

        res.json({ message: `Historial del alumno ID: ${alumnoId}`, data: ordenarFilas(filas) });
    } catch (error) {
        console.error('[historial] getHistorialByAlumno:', error);
        res.status(500).json({ error: "Error obteniendo el historial del alumno" });
    }
};

// ---------------------------------------------------------------------------
// POST /api/historial  (administrativos)
// Un registro { alumno_id, materia_id, estado, nota?, libro?, folio?, fechaActa?, fechaRegularizacion?, motivoVencimiento?, id? }
// o una lista de ellos (carga masiva: se valida todo antes de guardar, o no se guarda nada).
// ---------------------------------------------------------------------------

// Revisa un registro SIN escribir. Devuelve { status, error } o { nuevo, cierre, alumno } con lo que hay que guardar.
const planificarAlta = async (datos, lote) => {
    const alumnoId = entero(datos?.alumno_id);
    const materiaId = entero(datos?.materia_id);
    if (!alumnoId || !materiaId || vacio(datos?.estado)) {
        return { status: 400, error: "Faltan datos obligatorios: alumno_id, materia_id y estado" };
    }

    const [alumno, materia] = await Promise.all([
        Alumno.findOne({ id: alumnoId }).lean(),
        Materia.findOne({ id: materiaId }).lean()
    ]);
    if (!alumno) return { status: 404, error: `No existe el alumno ${alumnoId}` };
    if (!materia) return { status: 404, error: `No existe la materia ${materiaId}` };

    // La materia tiene que ser del plan de estudios del alumno (el de su cohorte)
    const plan = await obtenerPlanDeAlumno(alumno);
    if (plan && materia.plan_id !== plan.id) {
        return { status: 400, error: `La materia "${materia.nombre}" no pertenece al plan de estudios del alumno (${plan.nombre})` };
    }

    // Al cargar una nota, el libro y el folio del acta son obligatorios
    const { datos: validos, error } = validarRegistroHistorial(datos, { exigirActa: true });
    if (error) return { status: 400, error };

    const clave = `${alumnoId}:${materiaId}`;
    if (lote.pares.has(clave)) {
        return { status: 400, error: `El alumno ${alumnoId} aparece más de una vez con la materia ${materiaId} en la misma carga` };
    }
    lote.pares.add(clave);

    // Una sola cursada vigente por alumno y materia. Solo se puede abrir una nueva (recursada) si la anterior ya no sirve:
    // quedó Vencida o su regularidad se perdió por tiempo, llamados o ausentes. La anterior se conserva como historia.
    const existentes = await HistorialAcademico.find({ alumno_id: alumnoId, materia_id: materiaId }).lean();
    const actual = registroVigente(existentes, materiaId);
    let cierre = null;

    if (actual) {
        if (actual.estado === ESTADOS.VENCIDA) {
            cierre = { id: actual.id, cambios: { vigente: false }, previos: { vigente: true } };
        } else if (actual.estado === ESTADOS.REGULAR) {
            const { ctx } = await cargarContextoAcademico(alumno);
            const regularidad = evaluarRegularidad(actual, ctx);
            if (regularidad.vigente) {
                return { status: 409, error: `El alumno ya tiene "${materia.nombre}" Regular (registro ${actual.id}): modificá ese registro en lugar de crear otro` };
            }
            cierre = {
                id: actual.id,
                cambios: { vigente: false, estado: ESTADOS.VENCIDA, motivoVencimiento: regularidad.motivoPerdida },
                previos: { vigente: true, estado: actual.estado, motivoVencimiento: actual.motivoVencimiento ?? null }
            };
        } else {
            return { status: 409, error: `El alumno ya tiene "${materia.nombre}" en estado ${actual.estado} (registro ${actual.id}): modificá ese registro en lugar de crear otro` };
        }
    }

    // ID: el indicado (que no puede estar en uso) o el siguiente libre
    let id;
    if (!vacio(datos.id)) {
        id = entero(datos.id);
        if (!id) return { status: 400, error: "El ID del registro no es válido" };
        if (lote.ids.has(id) || await HistorialAcademico.findOne({ id }).lean()) {
            return { status: 409, error: `El ID de registro ${id} ya existe` };
        }
    } else {
        while (lote.ids.has(lote.proximoId)) lote.proximoId += 1;
        id = lote.proximoId;
    }
    lote.ids.add(id);

    const intento = existentes.reduce((mayor, h) => Math.max(mayor, h.intento ?? 1), 0) + 1;

    return {
        alumno,
        cierre,
        nuevo: { id, alumno_id: alumnoId, materia_id: materiaId, intento, vigente: true, ...validos }
    };
};

export const createRegistro = async (req, res) => {
    try {
        const esLote = Array.isArray(req.body);
        const entradas = esLote ? req.body : [req.body];

        if (entradas.length === 0) return res.status(400).json({ error: "No se recibió ningún registro" });
        if (entradas.length > MAX_REGISTROS_POR_CARGA) {
            return res.status(400).json({ error: `Una carga masiva admite hasta ${MAX_REGISTROS_POR_CARGA} registros` });
        }

        const lote = { pares: new Set(), ids: new Set(), proximoId: await siguienteId(HistorialAcademico) };

        // 1) Se revisa todo antes de escribir
        const plan = [];
        for (let i = 0; i < entradas.length; i++) {
            const resultado = await planificarAlta(entradas[i], lote);
            if (resultado.error) {
                return res.status(resultado.status).json({
                    error: esLote ? `Registro ${i + 1}: ${resultado.error}` : resultado.error
                });
            }
            plan.push(resultado);
        }

        // 2) Se guarda. Si falla el alta, se deshace el cierre de la cursada anterior para no dejar la materia sin registro vigente.
        const creados = [];
        for (const paso of plan) {
            if (paso.cierre) await HistorialAcademico.findOneAndUpdate({ id: paso.cierre.id }, paso.cierre.cambios);
            try {
                creados.push(await HistorialAcademico.create(paso.nuevo));
            } catch (errorAlta) {
                if (paso.cierre) await HistorialAcademico.findOneAndUpdate({ id: paso.cierre.id }, paso.cierre.previos);
                throw errorAlta;
            }
            if ([ESTADOS.REGULAR, ESTADOS.PROMOCIONADA, ESTADOS.APROBADA].includes(paso.nuevo.estado)) {
                await cerrarInscripcionDeCursada(paso.nuevo.alumno_id, paso.nuevo.materia_id);
            }
        }

        if (esLote) {
            return res.status(201).json({ message: 'Registros creados masivamente', data: creados });
        }

        const { regularidad, aviso } = await regularidadDespuesDeGuardar(creados[0]);
        res.status(201).json({
            message: 'Registro creado exitosamente',
            data: creados[0],
            recursada: plan[0].cierre !== null,
            regularidad,
            aviso
        });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ error: "El ID del registro ya existe" });
        console.error('[historial] createRegistro:', error);
        res.status(500).json({ error: "Error al crear el registro" });
    }
};

// ---------------------------------------------------------------------------
// PUT /api/historial/:id  (administrativos)
// Cambia estado, nota, libro, folio, fechas y motivo. Solo se modifica el registro VIGENTE de la materia;
// los intentos anteriores de una recursada quedan como historia.
// ---------------------------------------------------------------------------
export const updateRegistro = async (req, res) => {
    try {
        const id = entero(req.params.id);
        if (!id) return res.status(400).json({ error: "El ID del registro no es válido" });

        const registro = await HistorialAcademico.findOne({ id }).lean();
        if (!registro) return res.status(404).json({ error: "Registro no encontrado" });

        if (registro.vigente === false) {
            return res.status(409).json({ error: "Este registro es un intento anterior de la materia (quedó como historia) y no se modifica" });
        }

        const cuerpo = req.body ?? {};
        const nuevoEstado = cuerpo.estado ?? registro.estado;
        const cambiaEstado = nuevoEstado !== registro.estado;
        const cambiaNota = cuerpo.nota !== undefined && String(cuerpo.nota ?? '') !== String(registro.nota ?? '');

        // Una materia aprobada en una mesa de examen se corrige desde la mesa; si no, la inscripción y el historial quedarían con datos distintos
        const finalAprobado = await InscripcionFinal.findOne({ historial_id: id, estado: 'Aprobado' }).lean();
        if (finalAprobado) {
            const tocaElActa = cambiaEstado || cambiaNota
                || (cuerpo.libro !== undefined && String(cuerpo.libro ?? '').trim() !== (registro.libro || ''))
                || (cuerpo.folio !== undefined && String(cuerpo.folio ?? '').trim() !== (registro.folio || ''))
                || (!vacio(cuerpo.fechaActa) && !mismoDia(cuerpo.fechaActa, registro.fechaActa));
            if (tocaElActa) {
                return res.status(409).json({
                    error: `Esta materia se aprobó en una mesa de examen (inscripción a final ${finalAprobado.id}): corregí el resultado desde la mesa para que no queden datos distintos`,
                    inscripcion_final_id: finalAprobado.id
                });
            }
        }

        // Lo que no se envía se conserva
        const entrada = {
            estado: nuevoEstado,
            nota: cuerpo.nota !== undefined ? cuerpo.nota : registro.nota,
            libro: cuerpo.libro !== undefined ? cuerpo.libro : registro.libro,
            folio: cuerpo.folio !== undefined ? cuerpo.folio : registro.folio,
            fechaActa: cuerpo.fechaActa !== undefined ? cuerpo.fechaActa : registro.fechaActa,
            fechaRegularizacion: cuerpo.fechaRegularizacion !== undefined ? cuerpo.fechaRegularizacion : registro.fechaRegularizacion,
            motivoVencimiento: cuerpo.motivoVencimiento !== undefined ? cuerpo.motivoVencimiento : registro.motivoVencimiento
        };

        const dejaDeEstarAprobada = registro.estado === ESTADOS.APROBADA && nuevoEstado !== ESTADOS.APROBADA;
        if (dejaDeEstarAprobada) {
            // Se vuelve a la situación anterior al final: la nota de la cursada y sin los datos del acta del final
            if (cuerpo.nota === undefined) entrada.nota = registro.notaCursada ?? null;
            if (cuerpo.libro === undefined) entrada.libro = '';
            if (cuerpo.folio === undefined) entrada.folio = '';
            if (cuerpo.fechaActa === undefined) entrada.fechaActa = null;
        }
        // Al pasar a Aprobada, la nota, el libro, el folio y la fecha son los del acta del FINAL: no se reutilizan
        // los de la cursada (otro acta, otro libro) sin que se indiquen
        if (cambiaEstado && nuevoEstado === ESTADOS.APROBADA) {
            if (cuerpo.nota === undefined) entrada.nota = null;
            if (cuerpo.libro === undefined) entrada.libro = '';
            if (cuerpo.folio === undefined) entrada.folio = '';
            if (cuerpo.fechaActa === undefined) entrada.fechaActa = null;
        }
        if (nuevoEstado === ESTADOS.CURSANDO && cuerpo.nota === undefined) entrada.nota = null;

        // Al cargar o cambiar una nota (o cambiar de estado teniendo nota), el libro y el folio son obligatorios
        const exigirActa = cambiaNota || (cambiaEstado && !dejaDeEstarAprobada);
        const { datos: validos, error } = validarRegistroHistorial(entrada, { exigirActa });
        if (error) return res.status(400).json({ error });

        const cambios = { ...validos };

        // Un Regular cargado sin fecha de regularización (datos viejos) no la recibe de golpe al corregirle otro dato
        if (!cambiaEstado && registro.estado === ESTADOS.REGULAR && !registro.fechaRegularizacion && vacio(cuerpo.fechaRegularizacion)) {
            cambios.fechaRegularizacion = null;
        }

        // Al aprobar, `nota` pasa a ser la del final y la de la cursada se guarda aparte para poder restituirla
        if (nuevoEstado === ESTADOS.APROBADA && registro.estado !== ESTADOS.APROBADA) cambios.notaCursada = registro.nota ?? null;
        if (dejaDeEstarAprobada) cambios.notaCursada = null;

        const actualizado = await HistorialAcademico.findOneAndUpdate({ id }, cambios, { new: true });
        if (!actualizado) return res.status(404).json({ error: "Registro no encontrado" });

        // Si la cursada se cerró (regular, promocionada o aprobada), la inscripción a cursar deja de estar pendiente
        if (registro.estado === ESTADOS.CURSANDO && [ESTADOS.REGULAR, ESTADOS.PROMOCIONADA, ESTADOS.APROBADA].includes(nuevoEstado)) {
            await cerrarInscripcionDeCursada(registro.alumno_id, registro.materia_id);
        }

        const { regularidad, aviso } = await regularidadDespuesDeGuardar(actualizado);
        res.json({ message: "Registro actualizado", data: actualizado, regularidad, aviso });
    } catch (error) {
        console.error('[historial] updateRegistro:', error);
        res.status(500).json({ error: "Error al actualizar el registro" });
    }
};

// ---------------------------------------------------------------------------
// DELETE /api/historial/:id  (administrativos)
// Si el registro tiene inscripciones a finales asociadas no se borra salvo que se pida (?eliminarFinales=true),
// porque ahí están los resultados de los exámenes.
// ---------------------------------------------------------------------------
export const deleteRegistro = async (req, res) => {
    try {
        const id = entero(req.params.id);
        if (!id) return res.status(400).json({ error: "El ID del registro no es válido" });

        const registro = await HistorialAcademico.findOne({ id }).lean();
        if (!registro) return res.status(404).json({ error: "Registro no encontrado" });

        const finales = await InscripcionFinal.find({ historial_id: id }).lean();
        if (finales.length > 0 && !verdadero(req.query?.eliminarFinales)) {
            return res.status(409).json({
                error: `Este registro tiene ${finales.length} inscripción(es) a finales asociada(s) con sus resultados. Si igual querés borrarlo, repetí la baja con eliminarFinales=true`,
                finalesAsociados: finales.length
            });
        }

        if (finales.length > 0) await InscripcionFinal.deleteMany({ historial_id: id });
        const eliminado = await HistorialAcademico.findOneAndDelete({ id });
        if (!eliminado) return res.status(404).json({ error: "Registro no encontrado" });

        // Si se borra la cursada vigente, el alumno deja de estar cursando: se baja también su inscripción pendiente
        if (registro.estado === ESTADOS.CURSANDO && registro.vigente !== false) {
            await cerrarInscripcionDeCursada(registro.alumno_id, registro.materia_id);
        }

        // Si era una recursada, el intento anterior (que había quedado como historia) vuelve a ser el vigente
        if (registro.vigente !== false && (registro.intento ?? 1) > 1) {
            const previos = (await HistorialAcademico.find({ alumno_id: registro.alumno_id, materia_id: registro.materia_id }).lean())
                .sort((a, b) => (b.intento ?? 1) - (a.intento ?? 1));
            if (previos[0]) await HistorialAcademico.findOneAndUpdate({ id: previos[0].id }, { vigente: true });
        }

        res.json({ message: "Registro eliminado del historial", data: eliminado, finalesEliminados: finales.length });
    } catch (error) {
        console.error('[historial] deleteRegistro:', error);
        res.status(500).json({ error: "Error al eliminar el registro" });
    }
};

export default {
    getHistorial,
    getHistorialByAlumno,
    createRegistro,
    updateRegistro,
    deleteRegistro
};
