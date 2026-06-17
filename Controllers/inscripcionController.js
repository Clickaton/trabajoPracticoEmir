import Inscripcion from '../models/Inscripcion.js';
import Alumno from '../models/Alumno.js';
import Materia from '../models/Materia.js';
import Cohorte from '../models/Cohorte.js';
import PeriodoInscripcion from '../models/PeriodoInscripcion.js';
import Correlatividad from '../models/Correlatividad.js';
import HistorialAcademico from '../models/HistorialAcademico.js';

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

// Crear una inscripción (El Jefe Final)
export const createInscripcion = async (req, res) => {
    try {
        const { alumno_id, cohorte_id, materia_id } = req.body;

        if (!alumno_id || !cohorte_id || !materia_id) {
            return res.status(400).json({ error: "Faltan datos obligatorios (alumno_id, cohorte_id, materia_id)" });
        }

        // 1. Verificar Período Activo (con validación de reloj dinámico)
        const ahora = new Date();
        const periodosBBDD = await PeriodoInscripcion.find({ activo: true }).lean();
        
        const periodoActivo = periodosBBDD.find(p => {
            const inicio = new Date(p.fechaInicio);
            const [horaIn, minIn] = p.horaInicio.split(':');
            inicio.setHours(parseInt(horaIn), parseInt(minIn), 0, 0);

            const fin = new Date(p.fechaFin);
            const [horaFin, minFin] = p.horaFin.split(':');
            fin.setHours(parseInt(horaFin), parseInt(minFin), 0, 0);

            return ahora >= inicio && ahora <= fin;
        });

        if (!periodoActivo) {
            return res.status(400).json({ error: "No hay períodos de inscripción vigentes. Inscripciones cerradas." });
        }

        // 2. Verificar que el alumno exista
        const alumno = await Alumno.findOne({ id: parseInt(alumno_id) }).lean();
        if (!alumno) return res.status(404).json({ error: "Alumno no encontrado" });

        // 3. Verificar correlatividades
        const correlatividades = await Correlatividad.find({ materia_id: parseInt(materia_id) }).lean();
        const historialAlumno = await HistorialAcademico.find({ alumno_id: parseInt(alumno_id) }).lean();

        for (const regla of correlatividades) {
            const registroRequisito = historialAlumno.find(h => h.materia_id === regla.requisito_id);

            if (!registroRequisito) {
                return res.status(400).json({ error: `No cumple la correlatividad: falta cursar la materia ID ${regla.requisito_id}` });
            }

            if (regla.condicion === 'Regular' && !['Regular', 'Aprobada'].includes(registroRequisito.estado)) {
                return res.status(400).json({ error: `Necesitás tener Regular la materia ID ${regla.requisito_id}` });
            }

            if (regla.condicion === 'Aprobada' && registroRequisito.estado !== 'Aprobada') {
                return res.status(400).json({ error: `Necesitás tener Aprobada la materia ID ${regla.requisito_id}` });
            }
        }

        // 4. Verificar que no esté ya inscripto
        const yaInscripto = await Inscripcion.findOne({
            alumno_id: parseInt(alumno_id),
            materia_id: parseInt(materia_id),
            periodo_id: periodoActivo.id
        });

        if (yaInscripto) return res.status(400).json({ error: "El alumno ya está inscripto a esta materia en el período activo" });

        // TODO OK: Generar IDs automáticos para las nuevas escrituras
        const maxInscripcion = await Inscripcion.findOne().sort('-id').lean();
        const nuevoIdInscripcion = maxInscripcion ? maxInscripcion.id + 1 : 1;

        const maxHistorial = await HistorialAcademico.findOne().sort('-id').lean();
        const nuevoIdHistorial = maxHistorial ? maxHistorial.id + 1 : 1;

        // Escribir la Inscripción
        const nuevaInscripcion = await Inscripcion.create({
            id: nuevoIdInscripcion,
            alumno_id: parseInt(alumno_id),
            cohorte_id: parseInt(cohorte_id),
            materia_id: parseInt(materia_id),
            periodo_id: periodoActivo.id
        });

        // Escribir en el Historial Académico
        await HistorialAcademico.create({
            id: nuevoIdHistorial,
            alumno_id: parseInt(alumno_id),
            materia_id: parseInt(materia_id),
            estado: "Cursando",
            nota: null
        });

        res.status(201).json({ message: 'Inscripción realizada exitosamente y registrada en el historial', data: nuevaInscripcion });

    } catch (error) {
        res.status(500).json({ error: "Error interno procesando la inscripción" });
    }
};

// Eliminar una inscripción (solo si el período sigue activo)
export const deleteInscripcion = async (req, res) => {
    try {
        const { id } = req.params;
        
        const inscripcion = await Inscripcion.findOne({ id: parseInt(id) }).lean();
        if (!inscripcion) return res.status(404).json({ error: "Inscripción no encontrada" });

        // Verificamos de forma dinámica si el período de esa inscripción sigue vigente hoy
        const periodo = await PeriodoInscripcion.findOne({ id: inscripcion.periodo_id }).lean();
        const ahora = new Date();
        const fin = new Date(periodo?.fechaFin || 0);
        const [horaFin, minFin] = (periodo?.horaFin || "00:00").split(':');
        fin.setHours(parseInt(horaFin), parseInt(minFin), 0, 0);

        if (!periodo || !periodo.activo || ahora > fin) {
            return res.status(400).json({ error: "No se puede anular la inscripción, el período ya cerró" });
        }

        // Eliminamos la inscripción
        await Inscripcion.findOneAndDelete({ id: parseInt(id) });

        // Opcional: También eliminamos el registro "Cursando" del historial para mantener consistencia
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