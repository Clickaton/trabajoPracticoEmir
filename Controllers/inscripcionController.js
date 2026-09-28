import Inscripcion from '../models/Inscripcion.js';
import Alumno from '../models/Alumno.js';
import Materia from '../models/Materia.js';
import Cohorte from '../models/Cohorte.js';
import PeriodoInscripcion from '../models/PeriodoInscripcion.js';
import Correlatividad from '../models/Correlatividad.js';
import HistorialAcademico from '../models/HistorialAcademico.js';
import { parseLocalDateTime } from '../utils/dateUtils.js';

// Obtener todas las inscripciones agrupadas por cohorte y año de materia
export const getInscripciones = async (req, res) => {
    try {
        const inscripciones = await Inscripcion.find().lean();
        const alumnos = await Alumno.find().lean();
        const materias = await Materia.find().lean();
        const cohortes = await Cohorte.find().lean();
        const periodos = await PeriodoInscripcion.find().lean();

        const resultado = cohortes.map(cohorte => {
            const inscripcionesCohorte = inscripciones.filter(i => i.cohorte_id === cohorte.id);

            const porAnio = [1, 2, 3].map(anio => {
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
                });

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

        const inscripcionesAlumno = inscripciones.map(i => {
            const materia = materias.find(m => m.id === i.materia_id);
            const periodo = periodos.find(p => p.id === i.periodo_id);
            return {
                id: i.id,
                materia: materia ? materia.nombre : "Materia Desconocida",
                anio: materia ? materia.anio : null,
                periodo: periodo ? periodo.nombre : "Período Desconocido",
                fecha: i.fecha
            };
        }).sort((a, b) => a.anio - b.anio);

        res.json({ message: `Inscripciones del alumno: ${alumno.name}`, data: inscripcionesAlumno });
    } catch (error) {
        res.status(500).json({ error: "Error obteniendo las inscripciones del alumno" });
    }
};

// Crear una inscripción
export const createInscripcion = async (req, res) => {
    try {
        // Ahora recibimos 'materias_ids' como un array desde el frontend
        const { alumno_id, cohorte_id, materias_ids } = req.body;

        if (!alumno_id || !cohorte_id || !materias_ids || !materias_ids.length) {
            return res.status(400).json({ error: "Faltan datos obligatorios o no se seleccionó ninguna materia" });
        }

        // 1. Verificar Período Activo (con validación de reloj dinámico)
        const ahora = new Date();
        const periodosBBDD = await PeriodoInscripcion.find({ activo: true }).lean();
        
        const periodoActivo = periodosBBDD.find(p => {
            const inicio = parseLocalDateTime(p.fechaInicio, p.horaInicio);

            const fin = parseLocalDateTime(p.fechaFin, p.horaFin);

            return ahora >= inicio && ahora <= fin;
        });

        if (!periodoActivo) {
            return res.status(400).json({ error: "No hay períodos de inscripción vigentes. Inscripciones cerradas." });
        }

        // 2. Verificar que el alumno exista
        const alumno = await Alumno.findOne({ id: parseInt(alumno_id) }).lean();
        if (!alumno) return res.status(404).json({ error: "Alumno no encontrado" });

        // Traemos el historial una sola vez para no colapsar la BBDD
        const historialAlumno = await HistorialAcademico.find({ alumno_id: parseInt(alumno_id) }).lean();

        // Preparar IDs secuenciales en memoria para no consultarlos repetidamente en el bucle
        const maxInscripcion = await Inscripcion.findOne().sort('-id').lean();
        let nextInscripcionId = maxInscripcion ? maxInscripcion.id + 1 : 1;

        const maxHistorial = await HistorialAcademico.findOne().sort('-id').lean();
        let nextHistorialId = maxHistorial ? maxHistorial.id + 1 : 1;

        const inscripcionesExitosas = [];
        const errores = [];

        // 3. Iterar por cada materia tildada en el frontend
        for (const mat_id of materias_ids) {
            const materiaIdNum = parseInt(mat_id);
            const correlatividades = await Correlatividad.find({ materia_id: materiaIdNum }).lean();
            
            // Buscamos el nombre de la materia a la que se quiere anotar para armar un mensaje amigable
            const materiaDestino = await Materia.findOne({ id: materiaIdNum }).lean();
            const nombreDestino = materiaDestino ? materiaDestino.nombre : 'Materia';

            let cumpleCorrelatividad = true;

            for (const regla of correlatividades) {
                const registroRequisito = historialAlumno.find(h => h.materia_id === regla.requisito_id);
                const materiaRequisito = await Materia.findOne({ id: regla.requisito_id }).lean();
                const nombreMateria = materiaRequisito ? materiaRequisito.nombre : `Materia Requisito`;

                if (!registroRequisito) {
                    errores.push(`Para "${nombreDestino}": Falta cursar "${nombreMateria}"`);
                    cumpleCorrelatividad = false;
                    break;
                }
                if (regla.tipo_requisito === 'Regular' && !['Regular', 'Aprobada'].includes(registroRequisito.estado)) {
                    errores.push(`Para "${nombreDestino}": Debés tener Regular "${nombreMateria}"`);
                    cumpleCorrelatividad = false;
                    break;
                }
                if (regla.tipo_requisito === 'Aprobada' && registroRequisito.estado !== 'Aprobada') {
                    errores.push(`Para "${nombreDestino}": Debés tener Aprobada "${nombreMateria}"`);
                    cumpleCorrelatividad = false;
                    break;
                }
            }

            if (!cumpleCorrelatividad) continue; // Si no cumple, pasamos a la siguiente materia tildada

            // 4. Verificar que no esté ya inscripto
            const yaInscripto = await Inscripcion.findOne({
                alumno_id: parseInt(alumno_id),
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
                alumno_id: parseInt(alumno_id),
                cohorte_id: parseInt(cohorte_id),
                materia_id: materiaIdNum,
                periodo_id: periodoActivo.id
            });

            // Escribir en el Historial Académico
            await HistorialAcademico.create({
                id: nextHistorialId++, 
                alumno_id: parseInt(alumno_id),
                materia_id: materiaIdNum,
                estado: "Cursando",
                nota: null
            });

            inscripcionesExitosas.push(nuevaInscripcion);
        }

        // 6. Evaluar el resultado global del lote
        if (inscripcionesExitosas.length > 0) {
            res.status(201).json({ 
                message: `Inscripción masiva finalizada. Se anotó en ${inscripcionesExitosas.length} materia(s).`,
                errores: errores.length > 0 ? errores : null,
                data: inscripcionesExitosas 
            });
        } else {
            // Si el array de exitosas quedó vacío, significa que fallaron TODAS por correlatividad o duplicado.
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

        // Eliminamos la inscripción SIN importar si el período está abierto o cerrado
        await Inscripcion.findOneAndDelete({ id: parseInt(id) });

        // También eliminamos el registro "Cursando" del historial para mantener consistencia
        await HistorialAcademico.findOneAndDelete({
            alumno_id: inscripcion.alumno_id,
            materia_id: inscripcion.materia_id,
            estado: "Cursando"
        });

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