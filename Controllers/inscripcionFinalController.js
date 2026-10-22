// Inscripción a finales (mesas de examen) y carga de resultados.
// Las reglas (regularidad vigente, llamados, ausentes, correlatividades con final aprobado) viven en reglasAcademicasService.
import InscripcionFinal from '../models/InscripcionFinal.js';
import PeriodoInscripcion from '../models/PeriodoInscripcion.js';
import HistorialAcademico from '../models/HistorialAcademico.js';
import Alumno from '../models/Alumno.js';
import Materia from '../models/Materia.js';
import { isAdminRole } from '../middlewares/authHybrid.js';
import { cargarContextoAcademico } from '../services/contextoAcademicoService.js';
import { ESTADOS, evaluarFinal, evaluarRegularidad, resumenRegularidad, validarResultadoFinal } from '../services/reglasAcademicasService.js';
import { conDefectos } from '../services/planService.js';
import { ordenarMaterias, compararTexto } from '../utils/ordenarMaterias.js';
import { tipoDePeriodo, periodoVigente } from '../utils/periodoUtils.js';
import { parseLocalDate } from '../utils/dateUtils.js';

const aListaDeIds = (entrada) => {
    if (entrada === undefined || entrada === null || entrada === '') return [];
    return Array.isArray(entrada) ? entrada : [entrada];
};

const periodosDeFinalAbiertos = async (ahora) => {
    const activos = await PeriodoInscripcion.find({ activo: true }).lean();
    return activos.filter(p => tipoDePeriodo(p) === 'Final' && periodoVigente(p, ahora));
};

// Deshace una aprobación de final: la cursada vuelve a Regular con la nota que tenía antes
const cambiosParaRevertirAprobacion = (historial) => ({
    estado: ESTADOS.REGULAR,
    nota: historial.notaCursada ?? null,
    notaCursada: null,
    libro: '',
    folio: '',
    fechaActa: null
});

// ---------------------------------------------------------------------------
// GET /api/inscripciones-final/disponibles/:alumnoId
// Todas las materias de su plan con: si puede rendir el final y, si no, por qué; cuántos llamados le quedan.
// ---------------------------------------------------------------------------
export const getDisponibles = async (req, res) => {
    try {
        const alumno = await Alumno.findOne({ id: parseInt(req.params.alumnoId) }).lean();
        if (!alumno) return res.status(404).json({ error: "Alumno no encontrado" });

        const ahora = new Date();
        const periodos = await periodosDeFinalAbiertos(ahora);
        const { plan, materias, ctx, intentosFinal } = await cargarContextoAcademico(alumno, { ahora });

        const abiertas = intentosFinal.filter(f => f.estado === 'Inscripto');

        const data = materias.map(materia => {
            const evaluacion = evaluarFinal(materia.id, ctx);
            const registro = ctx.registro(materia.id);
            const inscripcion = abiertas.find(f => f.materia_id === materia.id);

            return {
                materia_id: materia.id,
                nombre: materia.nombre,
                anio: materia.anio,
                estado: registro ? registro.estado : 'Pendiente',
                puede: evaluacion.puede && !inscripcion,
                yaInscripto: Boolean(inscripcion),
                inscripcion_id: inscripcion ? inscripcion.id : null,
                periodo_id: inscripcion ? inscripcion.periodo_id : null,
                motivos: evaluacion.motivos.map(m => ({ codigo: m.codigo, mensaje: m.mensaje })),
                regularidad: resumenRegularidad(evaluacion.regularidad)
            };
        });

        const planCompleto = conDefectos(plan);
        res.json({
            message: 'Materias para inscripción a finales',
            periodoAbierto: periodos.length > 0,
            periodos,
            plan: plan ? {
                id: plan.id,
                nombre: plan.nombre,
                vencimientoRegularidadMeses: planCompleto.vencimientoRegularidadMeses,
                maxLlamadosConsecutivos: planCompleto.maxLlamadosConsecutivos,
                maxAusentes: planCompleto.maxAusentes
            } : null,
            data
        });
    } catch (error) {
        res.status(500).json({ error: "Error obteniendo las materias para inscripción a finales" });
    }
};

// ---------------------------------------------------------------------------
// GET /api/inscripciones-final/alumno/:alumnoId  (inscripciones y resultados de finales del alumno)
// ---------------------------------------------------------------------------
export const getFinalesByAlumno = async (req, res) => {
    try {
        const alumnoId = parseInt(req.params.alumnoId);
        const alumno = await Alumno.findOne({ id: alumnoId }).lean();
        if (!alumno) return res.status(404).json({ error: "Alumno no encontrado" });

        const [finales, materias, periodos] = await Promise.all([
            InscripcionFinal.find({ alumno_id: alumnoId }).lean(),
            Materia.find().lean(),
            PeriodoInscripcion.find().lean()
        ]);

        const filas = finales
            .sort((a, b) => new Date(a.fecha) - new Date(b.fecha)) // cronológico: el orden por materia después es estable
            .map(f => {
                const materia = materias.find(m => m.id === f.materia_id);
                const periodo = periodos.find(p => p.id === f.periodo_id);
                return {
                    id: f.id,
                    materia_id: f.materia_id,
                    materia: materia ? materia.nombre : "Materia Desconocida",
                    anio: materia ? materia.anio : null,
                    periodo_id: f.periodo_id,
                    periodo: periodo ? periodo.nombre : "Período Desconocido",
                    fecha: f.fecha,
                    fechaExamen: f.fechaExamen ?? periodo?.fechaExamen ?? null,
                    estado: f.estado,
                    nota: f.nota,
                    libro: f.libro,
                    folio: f.folio
                };
            });

        res.json({
            message: `Finales del alumno: ${alumno.name}`,
            data: ordenarMaterias(filas, { nombre: (fila) => fila.materia }) // por año y nombre de materia
        });
    } catch (error) {
        res.status(500).json({ error: "Error obteniendo los finales del alumno" });
    }
};

// ---------------------------------------------------------------------------
// POST /api/inscripciones-final   { alumno_id, periodo_id?, materias_ids: [..] }  (o materia_id)
//   El alumno solo se puede inscribir en un período de Final abierto.
//   Excepción del preceptor: un administrativo puede inscribir a un alumno en CUALQUIER período de Final (también uno
//   cerrado o fuera de fecha: el alumno tuvo un problema con el sistema, pidió una excepción o se pasó de la hora límite).
//   Las reglas académicas (regularidad, llamados, ausentes y correlatividades) se controlan igual.
// ---------------------------------------------------------------------------
export const createInscripcionFinal = async (req, res) => {
    try {
        const { alumno_id, periodo_id, materias_ids, materia_id } = req.body;
        const lista = aListaDeIds(materias_ids ?? materia_id);

        if (!alumno_id || lista.length === 0) {
            return res.status(400).json({ error: "Faltan datos obligatorios o no se seleccionó ninguna materia" });
        }

        // 1. Período de FINAL vigente (si hay más de uno abierto hay que indicar cuál)
        const ahora = new Date();
        const abiertos = await periodosDeFinalAbiertos(ahora);
        const esAdmin = isAdminRole(req.user);

        let periodo;
        let porExcepcion = false;
        if (periodo_id !== undefined && periodo_id !== null && periodo_id !== '') {
            if (esAdmin) {
                const elegido = Number.isNaN(parseInt(periodo_id)) ? null : await PeriodoInscripcion.findOne({ id: parseInt(periodo_id) }).lean();
                if (!elegido || tipoDePeriodo(elegido) !== 'Final') {
                    return res.status(400).json({ error: "El período indicado no existe o no es de finales." });
                }
                periodo = elegido;
                porExcepcion = !periodoVigente(elegido, ahora);
            } else {
                periodo = abiertos.find(p => p.id === parseInt(periodo_id));
                if (!periodo) return res.status(400).json({ error: "El período indicado no es de finales o no está vigente." });
            }
        } else if (abiertos.length === 1) {
            periodo = abiertos[0];
        } else if (abiertos.length === 0) {
            return res.status(400).json({ error: "No hay períodos de inscripción a finales vigentes. Inscripciones cerradas." });
        } else {
            return res.status(400).json({ error: "Hay más de un período de finales abierto: indicá a cuál querés inscribirte (periodo_id)." });
        }

        // 2. Alumno y plan
        const alumno = await Alumno.findOne({ id: parseInt(alumno_id) }).lean();
        if (!alumno) return res.status(404).json({ error: "Alumno no encontrado" });
        if (!alumno.cohorte_id) return res.status(400).json({ error: "El alumno no tiene una cohorte asignada" });

        const { plan, materias, ctx, intentosFinal } = await cargarContextoAcademico(alumno, { ahora });
        if (!plan) return res.status(400).json({ error: "La cohorte del alumno no tiene un plan de estudios asignado" });
        const materiasDelPlan = new Map(materias.map(m => [m.id, m]));

        const creadas = [];
        const errores = [];

        // 3. Cada materia tildada, sin repetidas
        const idsUnicos = [...new Set(lista.map(m => parseInt(m, 10)))];
        for (const materiaId of idsUnicos) {
            const materia = materiasDelPlan.get(materiaId);
            if (!materia) {
                errores.push(`La materia ${materiaId} no pertenece al plan de estudios "${plan.nombre}" del alumno.`);
                continue;
            }

            // Regularidad vigente, llamados/ausentes y correlatividades con el final aprobado
            const evaluacion = evaluarFinal(materiaId, ctx);
            if (!evaluacion.puede) {
                errores.push(`Para "${materia.nombre}": ${evaluacion.motivos.map(m => m.mensaje).join('; ')}`);
                continue;
            }

            const previas = intentosFinal.filter(f => f.materia_id === materiaId && f.estado !== 'Anulada');
            if (previas.some(f => f.estado === 'Inscripto')) {
                errores.push(esAdmin ? `El alumno ya está inscripto al final de "${materia.nombre}".` : `Ya estás inscripto al final de "${materia.nombre}".`);
                continue;
            }
            if (previas.some(f => f.periodo_id === periodo.id)) {
                errores.push(esAdmin ? `El alumno ya figura en "${materia.nombre}" para este llamado.` : `Ya figurás en "${materia.nombre}" para este llamado.`);
                continue;
            }

            try {
                const nueva = await InscripcionFinal.create({
                    alumno_id: alumno.id,
                    cohorte_id: alumno.cohorte_id,
                    materia_id: materiaId,
                    periodo_id: periodo.id,
                    historial_id: ctx.registro(materiaId).id,
                    estado: 'Inscripto'
                });
                creadas.push(nueva);
            } catch (errorAlta) {
                // El índice único de la base frena el doble pedido simultáneo
                errores.push(errorAlta.code === 11000
                    ? (esAdmin ? `El alumno ya está inscripto al final de "${materia.nombre}".` : `Ya estás inscripto al final de "${materia.nombre}".`)
                    : `No se pudo inscribir al final de "${materia.nombre}". Intentá de nuevo.`);
            }
        }

        if (creadas.length > 0) {
            return res.status(201).json({
                message: esAdmin
                    ? `Inscripción a finales finalizada: ${creadas.length} materia(s) en "${periodo.nombre}"${porExcepcion ? ' (período cerrado: inscripción por excepción)' : ''}.`
                    : `Inscripción a finales finalizada. Te anotaste en ${creadas.length} materia(s).`,
                errores: errores.length > 0 ? errores : null,
                periodo: { id: periodo.id, nombre: periodo.nombre },
                porExcepcion,
                data: creadas
            });
        }

        res.status(400).json({ error: "No se pudo inscribir en ninguna de las materias seleccionadas.", detalleErrores: errores });
    } catch (error) {
        res.status(500).json({ error: "Error interno procesando la inscripción a finales" });
    }
};

// ---------------------------------------------------------------------------
// DELETE /api/inscripciones-final/:id  -> deja la inscripción en estado "Anulada" (no se borra, queda el rastro)
//   - El alumno solo puede anular la suya, mientras no se rindió y el período siga abierto.
//   - El administrativo puede anular también un resultado ya cargado (corrección): una aprobación se deshace.
// ---------------------------------------------------------------------------
export const anularInscripcionFinal = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const inscripcion = await InscripcionFinal.findOne({ id }).lean();
        if (!inscripcion) return res.status(404).json({ error: "Inscripción a final no encontrada" });

        const esAdmin = isAdminRole(req.user);
        if (!esAdmin && String(inscripcion.alumno_id) !== String(req.user?.id)) {
            return res.status(403).json({ error: "No autorizado: esta inscripción no pertenece al usuario autenticado" });
        }
        if (inscripcion.estado === 'Anulada') {
            return res.status(400).json({ error: "La inscripción ya estaba anulada" });
        }

        if (!esAdmin) {
            if (inscripcion.estado !== 'Inscripto') {
                return res.status(400).json({ error: "Solo se puede anular una inscripción cuyo final todavía no se rindió" });
            }
            const periodo = await PeriodoInscripcion.findOne({ id: inscripcion.periodo_id }).lean();
            if (!periodo || !periodoVigente(periodo)) {
                return res.status(400).json({ error: "El período de inscripción a finales ya cerró: consultá en Secretaría" });
            }
        }

        if (inscripcion.estado === 'Aprobado' && inscripcion.historial_id) {
            const historial = await HistorialAcademico.findOne({ id: inscripcion.historial_id }).lean();
            if (historial && historial.estado === ESTADOS.APROBADA) {
                await HistorialAcademico.findOneAndUpdate({ id: historial.id }, cambiosParaRevertirAprobacion(historial));
            }
        }

        const anulada = await InscripcionFinal.findOneAndUpdate(
            { id },
            { estado: 'Anulada', nota: null, libro: '', folio: '', fechaExamen: null },
            { new: true }
        );

        res.json({ message: "Inscripción a final anulada", data: anulada });
    } catch (error) {
        res.status(500).json({ error: "Error al anular la inscripción a final" });
    }
};

// ---------------------------------------------------------------------------
// GET /api/inscripciones-final/periodo/:periodoId[?materia_id=]   (administrativos: lista de la mesa)
// ---------------------------------------------------------------------------
export const getMesa = async (req, res) => {
    try {
        const periodoId = parseInt(req.params.periodoId);
        const periodo = await PeriodoInscripcion.findOne({ id: periodoId }).lean();
        if (!periodo) return res.status(404).json({ error: "Período no encontrado" });

        const filtro = { periodo_id: periodoId };
        if (req.query.materia_id !== undefined && req.query.materia_id !== '') {
            const materiaId = parseInt(req.query.materia_id, 10);
            if (Number.isNaN(materiaId)) return res.status(400).json({ error: "materia_id inválido" });
            filtro.materia_id = materiaId;
        }

        const inscripciones = (await InscripcionFinal.find(filtro).lean()).filter(i => i.estado !== 'Anulada');
        const [alumnos, materias] = await Promise.all([
            Alumno.find({ id: { $in: [...new Set(inscripciones.map(i => i.alumno_id))] } }).lean(),
            Materia.find({ id: { $in: [...new Set(inscripciones.map(i => i.materia_id))] } }).lean()
        ]);

        const grupos = materias.map(materia => ({
            materia_id: materia.id,
            materia: materia.nombre,
            anio: materia.anio,
            plan_id: materia.plan_id ?? null,
            inscriptos: inscripciones
                .filter(i => i.materia_id === materia.id)
                .map(i => {
                    const alumno = alumnos.find(a => a.id === i.alumno_id);
                    return {
                        id: i.id,
                        alumno_id: i.alumno_id,
                        alumno: alumno ? alumno.name : "Alumno Desconocido",
                        dni: alumno ? alumno.dni : null,
                        legajo: alumno ? alumno.legajo : null,
                        estado: i.estado,
                        nota: i.nota,
                        libro: i.libro,
                        folio: i.folio,
                        fechaExamen: i.fechaExamen
                    };
                })
                .sort((a, b) => compararTexto(a.alumno, b.alumno))
        }));

        res.json({
            message: `Mesa de examen: ${periodo.nombre}`,
            periodo: { id: periodo.id, nombre: periodo.nombre, tipo: tipoDePeriodo(periodo), fechaExamen: periodo.fechaExamen ?? null },
            data: ordenarMaterias(grupos, { grupo: (g) => g.plan_id, nombre: (g) => g.materia }) // por año y nombre de materia
        });
    } catch (error) {
        res.status(500).json({ error: "Error obteniendo la mesa de examen" });
    }
};

// ---------------------------------------------------------------------------
// PUT /api/inscripciones-final/:id/resultado   { resultado: 'Aprobado'|'Desaprobado'|'Ausente', nota, libro, folio, fechaExamen? }
//   Aprobado    -> la cursada pasa a Aprobada con la nota y los datos del acta (libro, folio, fecha)
//   Desaprobado / Ausente -> consumen un llamado de la cursada regular (el Ausente además suma una ausencia)
// Se puede volver a llamar para CORREGIR un resultado ya cargado.
// ---------------------------------------------------------------------------
export const cargarResultado = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const inscripcion = await InscripcionFinal.findOne({ id }).lean();
        if (!inscripcion) return res.status(404).json({ error: "Inscripción a final no encontrada" });
        if (inscripcion.estado === 'Anulada') return res.status(400).json({ error: "La inscripción está anulada: no admite resultados" });

        const { datos, error } = validarResultadoFinal({
            resultado: req.body.resultado ?? req.body.estado,
            nota: req.body.nota,
            libro: req.body.libro,
            folio: req.body.folio
        });
        if (error) return res.status(400).json({ error });

        // Fecha del examen: la indicada, o la ya cargada, o la de la mesa, o hoy
        const periodo = await PeriodoInscripcion.findOne({ id: inscripcion.periodo_id }).lean();
        let fechaExamen;
        if (req.body.fechaExamen) {
            fechaExamen = parseLocalDate(req.body.fechaExamen);
            if (!fechaExamen) return res.status(400).json({ error: "La fecha del examen no es válida" });
        } else {
            fechaExamen = parseLocalDate(inscripcion.fechaExamen ?? periodo?.fechaExamen ?? new Date());
        }

        // La cursada sobre la que se rinde el final (de ella se cuentan los llamados y las ausencias)
        const historial = inscripcion.historial_id ? await HistorialAcademico.findOne({ id: inscripcion.historial_id }).lean() : null;
        if (!historial) return res.status(409).json({ error: "No se encontró la cursada asociada a este final" });

        const eraAprobado = inscripcion.estado === 'Aprobado';

        // Se valida TODO antes de escribir para no dejar una corrección a medias
        if (datos.resultado === 'Aprobado') {
            const estadoBase = eraAprobado ? ESTADOS.REGULAR : historial.estado;
            if (estadoBase !== ESTADOS.REGULAR) {
                return res.status(409).json({ error: `La cursada asociada está "${historial.estado}": solo se aprueba el final de una cursada Regular` });
            }
        }

        if (datos.resultado === 'Aprobado') {
            await HistorialAcademico.findOneAndUpdate({ id: historial.id }, {
                estado: ESTADOS.APROBADA,
                nota: datos.nota,
                libro: datos.libro,
                folio: datos.folio,
                fechaActa: fechaExamen,
                notaCursada: eraAprobado ? (historial.notaCursada ?? null) : (historial.nota ?? null)
            });
        } else if (eraAprobado && historial.estado === ESTADOS.APROBADA) {
            await HistorialAcademico.findOneAndUpdate({ id: historial.id }, cambiosParaRevertirAprobacion(historial));
        }

        const actualizada = await InscripcionFinal.findOneAndUpdate(
            { id },
            { estado: datos.resultado, nota: datos.nota, libro: datos.libro, folio: datos.folio, fechaExamen },
            { new: true }
        );

        // Cómo quedó la regularidad después de este resultado (¿perdió la cursada por llamados o ausentes?)
        let regularidad = null;
        let aviso = null;
        const alumno = await Alumno.findOne({ id: inscripcion.alumno_id }).lean();
        if (alumno) {
            const { ctx } = await cargarContextoAcademico(alumno);
            const evaluada = evaluarRegularidad(ctx.registro(inscripcion.materia_id), ctx);
            regularidad = resumenRegularidad(evaluada);
            if (evaluada.aplica && !evaluada.vigente) {
                aviso = evaluarFinal(inscripcion.materia_id, ctx).motivos[0]?.mensaje ?? null;
            }
        }

        res.json({ message: "Resultado del final cargado", data: actualizada, regularidad, aviso });
    } catch (error) {
        res.status(500).json({ error: "Error al cargar el resultado del final" });
    }
};

export default {
    getDisponibles,
    getFinalesByAlumno,
    createInscripcionFinal,
    anularInscripcionFinal,
    getMesa,
    cargarResultado
};
