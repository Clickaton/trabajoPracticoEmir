import Inscripcion from '../models/Inscripcion.js';
import Alumno from '../models/Alumno.js';
import Materia from '../models/Materia.js';
import Cohorte from '../models/Cohorte.js';
import PeriodoInscripcion from '../models/PeriodoInscripcion.js';
import HistorialAcademico from '../models/HistorialAcademico.js';
import PlanEstudio from '../models/PlanEstudio.js';
import { ordenarMaterias, compararTexto } from '../utils/ordenarMaterias.js';
import { tipoDePeriodo, periodoVigente } from '../utils/periodoUtils.js';
import { siguienteId } from '../utils/siguienteId.js';
import { isAdminRole } from '../middlewares/authHybrid.js';
import { cargarContextoAcademico } from '../services/contextoAcademicoService.js';
import { ESTADOS, evaluarInscripcionCursada, evaluarRegularidad } from '../services/reglasAcademicasService.js';

// Obtener todas las inscripciones agrupadas por cohorte y año de materia
export const getInscripciones = async (req, res) => {
    try {
        const inscripciones = await Inscripcion.find().lean();
        const alumnos = await Alumno.find().lean();
        const materias = await Materia.find().lean();
        const cohortes = await Cohorte.find().lean();
        const periodos = await PeriodoInscripcion.find().lean();
        const planes = await PlanEstudio.find().lean();

        const resultado = cohortes.map(cohorte => {
            const inscripcionesCohorte = inscripciones.filter(i => i.cohorte_id === cohorte.id);

            // La cantidad de años depende del plan de la cohorte (antes estaba fija en 3)
            const duracionAnios = planes.find(p => p.id === cohorte.plan_id)?.duracionAnios || 3;
            const anios = Array.from({ length: duracionAnios }, (_, i) => i + 1);

            const porAnio = anios.map(anio => {
                const materiasAnio = inscripcionesCohorte.filter(i => {
                    const materia = materias.find(m => m.id === i.materia_id);
                    return materia && materia.anio === anio;
                }).map(i => {
                    const alumno = alumnos.find(a => a.id === i.alumno_id);
                    const materia = materias.find(m => m.id === i.materia_id);
                    const periodo = periodos.find(p => p.id === i.periodo_id);
                    return {
                        alumno: alumno ? alumno.name : "Alumno Desconocido",
                        materia: materia ? materia.nombre : "Materia Desconocida",
                        periodo: periodo ? periodo.nombre : "Período Desconocido",
                        fecha: i.fecha
                    };
                }).sort((a, b) => compararTexto(a.materia, b.materia) || compararTexto(a.alumno, b.alumno));

                return { anio, inscripciones: materiasAnio };
            });

            return { cohorte: cohorte.name, inscripciones: porAnio };
        });

        res.json({ message: 'Lista de inscripciones', data: resultado });
    } catch (error) {
        res.status(500).json({ error: "Error obteniendo las inscripciones globales" });
    }
};

// Obtener inscripciones de un solo alumno
export const getInscripcionesByAlumno = async (req, res) => {
    try {
        const { alumnoId } = req.params;
        const alumno = await Alumno.findOne({ id: parseInt(alumnoId) }).lean();
        if (!alumno) return res.status(404).json({ error: "Alumno no encontrado" });

        const inscripciones = await Inscripcion.find({ alumno_id: parseInt(alumnoId) }).lean();
        const materias = await Materia.find().lean();
        const periodos = await PeriodoInscripcion.find().lean();

        const inscripcionesAlumno = ordenarMaterias(
            inscripciones.map(i => {
                const materia = materias.find(m => m.id === i.materia_id);
                const periodo = periodos.find(p => p.id === i.periodo_id);
                return {
                    id: i.id,
                    materia: materia ? materia.nombre : "Materia Desconocida",
                    anio: materia ? materia.anio : null,
                    periodo: periodo ? periodo.nombre : "Período Desconocido",
                    fecha: i.fecha
                };
            }),
            { nombre: (fila) => fila.materia } // por año y, dentro de cada año, por nombre
        );

        res.json({ message: `Inscripciones del alumno: ${alumno.name}`, data: inscripcionesAlumno });
    } catch (error) {
        res.status(500).json({ error: "Error obteniendo las inscripciones del alumno" });
    }
};

// Crear una inscripción a cursada (acepta varias materias en un mismo pedido).
// Las reglas (correlatividades, regularidad vencida, recursada) viven en reglasAcademicasService.
export const createInscripcion = async (req, res) => {
    try {
        // Recibimos 'materias_ids' como un array desde el frontend. 'periodo_id' es opcional (si hay varios períodos abiertos)
        const { alumno_id, materias_ids, periodo_id } = req.body;
        const listaMaterias = Array.isArray(materias_ids) ? materias_ids : (materias_ids ? [materias_ids] : []);

        if (!alumno_id || listaMaterias.length === 0) {
            return res.status(400).json({ error: "Faltan datos obligatorios o no se seleccionó ninguna materia" });
        }

        // 1. Verificar Período de CURSADA vigente (con validación de reloj dinámico). Los períodos de Final no sirven acá.
        const ahora = new Date();
        const periodosBBDD = await PeriodoInscripcion.find({ activo: true }).lean();
        const abiertos = periodosBBDD.filter(p => tipoDePeriodo(p) === 'Cursada' && periodoVigente(p, ahora));

        let periodoActivo;
        if (periodo_id !== undefined && periodo_id !== null && periodo_id !== '') {
            periodoActivo = abiertos.find(p => p.id === parseInt(periodo_id));
            if (!periodoActivo) {
                return res.status(400).json({ error: "El período indicado no es de cursada o no está vigente." });
            }
        } else {
            periodoActivo = abiertos[0];
        }

        if (!periodoActivo) {
            return res.status(400).json({ error: "No hay períodos de inscripción vigentes. Inscripciones cerradas." });
        }

        // 2. Verificar que el alumno exista y tenga un plan de estudios (el de su cohorte)
        const alumno = await Alumno.findOne({ id: parseInt(alumno_id) }).lean();
        if (!alumno) return res.status(404).json({ error: "Alumno no encontrado" });
        if (!alumno.cohorte_id) return res.status(400).json({ error: "El alumno no tiene una cohorte asignada" });

        // Traemos plan, historial, correlatividades y finales UNA sola vez para no colapsar la BBDD
        const { plan, materias, ctx } = await cargarContextoAcademico(alumno, { ahora });
        if (!plan) return res.status(400).json({ error: "La cohorte del alumno no tiene un plan de estudios asignado" });
        const materiasDelPlan = new Map(materias.map(m => [m.id, m]));

        // Preparar IDs secuenciales en memoria para no consultarlos repetidamente en el bucle
        let nextInscripcionId = await siguienteId(Inscripcion);
        let nextHistorialId = await siguienteId(HistorialAcademico);

        const inscripcionesExitosas = [];
        const recursadas = [];
        const errores = [];

        // 3. Iterar por cada materia tildada en el frontend (sin repetidas)
        const idsUnicos = [...new Set(listaMaterias.map(m => parseInt(m, 10)))];
        for (const materiaIdNum of idsUnicos) {
            const materia = materiasDelPlan.get(materiaIdNum);
            if (!materia) {
                errores.push(`La materia ${materiaIdNum} no pertenece al plan de estudios "${plan.nombre}" del alumno.`);
                continue;
            }
            const nombreDestino = materia.nombre;

            // 3.1 Estado propio de la materia + correlatividades
            const evaluacion = evaluarInscripcionCursada(materiaIdNum, ctx);
            if (evaluacion.bloqueo) {
                errores.push(`Para "${nombreDestino}": ${evaluacion.bloqueo.mensaje}`);
                continue;
            }
            if (!evaluacion.correlativas.cumple) {
                errores.push(`Para "${nombreDestino}": ${evaluacion.correlativas.faltantes.map(f => f.mensaje).join('; ')}`);
                continue;
            }

            // 4. Verificar que no esté ya inscripto en este período.
            //    En una recursada no aplica: la inscripción que haya en ese período es de la cursada anterior.
            const yaInscripto = evaluacion.recursada ? null : await Inscripcion.findOne({
                alumno_id: alumno.id,
                materia_id: materiaIdNum,
                periodo_id: periodoActivo.id
            });

            if (yaInscripto) {
                errores.push(`Ya estabas inscripto en "${nombreDestino}".`);
                continue;
            }

            // 5. Todo OK: Escribir la Inscripción
            const nuevaInscripcion = await Inscripcion.create({
                id: nextInscripcionId++,
                alumno_id: alumno.id,
                cohorte_id: alumno.cohorte_id,
                materia_id: materiaIdNum,
                periodo_id: periodoActivo.id
            });

            // Escribir en el Historial Académico. En una recursada es un registro NUEVO (intento + 1):
            // el anterior no se pisa, queda guardado como historia.
            try {
                await HistorialAcademico.create({
                    id: nextHistorialId++,
                    alumno_id: alumno.id,
                    materia_id: materiaIdNum,
                    estado: ESTADOS.CURSANDO,
                    nota: null,
                    intento: evaluacion.proximoIntento,
                    vigente: true
                });
            } catch (errorHistorial) {
                await Inscripcion.findOneAndDelete({ id: nuevaInscripcion.id }); // no dejamos una inscripción sin cursada
                errores.push(`No se pudo registrar la cursada de "${nombreDestino}". Intentá de nuevo.`);
                continue;
            }

            if (evaluacion.recursada) {
                // La cursada anterior pasa a "Vencida" (con el motivo) y deja de ser la vigente
                const anterior = ctx.registro(materiaIdNum);
                const motivo = anterior.estado === ESTADOS.VENCIDA
                    ? (anterior.motivoVencimiento ?? null)
                    : evaluarRegularidad(anterior, ctx).motivoPerdida;
                await HistorialAcademico.findOneAndUpdate(
                    { id: anterior.id },
                    { vigente: false, estado: ESTADOS.VENCIDA, motivoVencimiento: motivo }
                );
                recursadas.push({ materia_id: materiaIdNum, materia: nombreDestino, intento: evaluacion.proximoIntento });
            }

            inscripcionesExitosas.push(nuevaInscripcion);
        }

        // 6. Evaluar el resultado global del lote
        if (inscripcionesExitosas.length > 0) {
            res.status(201).json({ 
                message: `Inscripción masiva finalizada. Se anotó en ${inscripcionesExitosas.length} materia(s).`,
                errores: errores.length > 0 ? errores : null,
                recursadas: recursadas.length > 0 ? recursadas : null,
                data: inscripcionesExitosas 
            });
        } else {
            // Si el array de exitosas quedó vacío, significa que fallaron TODAS por correlatividad, estado o duplicado.
            res.status(400).json({ 
                error: "No se pudo inscribir en ninguna materia seleccionada.",
                detalleErrores: errores 
            });
        }

    } catch (error) {
        res.status(500).json({ error: "Error interno procesando la inscripción múltiple" });
    }
};

export const deleteInscripcion = async (req, res) => {
    try {
        const { id } = req.params;
        
        const inscripcion = await Inscripcion.findOne({ id: parseInt(id) }).lean();
        if (!inscripcion) return res.status(404).json({ error: "Inscripción no encontrada" });

        // Un alumno solo puede anular SUS inscripciones (antes la ruta comparaba el id de la inscripción con el del usuario)
        if (!isAdminRole(req.user) && String(inscripcion.alumno_id) !== String(req.user?.id)) {
            return res.status(403).json({ error: "No autorizado: esta inscripción no pertenece al usuario autenticado" });
        }

        // Eliminamos la inscripción SIN importar si el período está abierto o cerrado
        await Inscripcion.findOneAndDelete({ id: parseInt(id) });

        // También eliminamos el registro "Cursando" vigente del historial para mantener consistencia
        const cursando = (await HistorialAcademico.find({
            alumno_id: inscripcion.alumno_id,
            materia_id: inscripcion.materia_id,
            estado: ESTADOS.CURSANDO
        }).lean()).filter(h => h.vigente !== false).sort((a, b) => (b.intento ?? 1) - (a.intento ?? 1))[0];

        if (cursando) {
            await HistorialAcademico.findOneAndDelete({ id: cursando.id });

            // Si era una recursada, el intento anterior (que quedó como historia) vuelve a ser el vigente
            if ((cursando.intento ?? 1) > 1) {
                const previos = (await HistorialAcademico.find({
                    alumno_id: inscripcion.alumno_id,
                    materia_id: inscripcion.materia_id
                }).lean()).sort((a, b) => (b.intento ?? 1) - (a.intento ?? 1));
                if (previos[0]) await HistorialAcademico.findOneAndUpdate({ id: previos[0].id }, { vigente: true });
            }
        }

        res.json({ message: "Inscripción anulada exitosamente", data: inscripcion });
    } catch (error) {
        res.status(500).json({ error: "Error al anular la inscripción" });
    }
};

export default {
    getInscripciones,
    getInscripcionesByAlumno,
    createInscripcion,
    deleteInscripcion
};