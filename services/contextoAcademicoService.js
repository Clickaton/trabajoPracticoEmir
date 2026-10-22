// Carga desde la base TODO lo que las reglas académicas necesitan para evaluar a un alumno
// (plan, materias del plan, correlatividades, historial, finales y períodos de final) y devuelve el contexto ya armado.
// Lo usan las inscripciones, el estado académico y el semáforo; la lógica de las reglas vive en reglasAcademicasService (pura).
import HistorialAcademico from '../models/HistorialAcademico.js';
import Correlatividad from '../models/Correlatividad.js';
import InscripcionFinal from '../models/InscripcionFinal.js';
import PeriodoInscripcion from '../models/PeriodoInscripcion.js';
import { obtenerPlanDeAlumno, materiasDelPlan } from './planService.js';
import { crearContexto } from './reglasAcademicasService.js';
import { tipoDePeriodo } from '../utils/periodoUtils.js';

// Cada período de Final que pasa consume un llamado de las cursadas regulares (ver reglasAcademicasService)
const cargarPeriodosFinal = async () => (await PeriodoInscripcion.find().lean()).filter(p => tipoDePeriodo(p) === 'Final');

export const cargarContextoAcademico = async (alumno, { ahora = new Date() } = {}) => {
    const plan = await obtenerPlanDeAlumno(alumno);
    const materias = await materiasDelPlan(plan?.id);

    const [historial, correlativas, intentosFinal, periodosFinal] = await Promise.all([
        HistorialAcademico.find({ alumno_id: alumno.id }).lean(),
        Correlatividad.find({ materia_id: { $in: materias.map(m => m.id) } }).lean(),
        InscripcionFinal.find({ alumno_id: alumno.id }).lean(),
        cargarPeriodosFinal()
    ]);

    return {
        plan,
        materias,
        historial,
        intentosFinal,
        periodosFinal,
        ctx: crearContexto({ historial, correlativas, intentosFinal, periodosFinal, materias, plan, ahora })
    };
};

// Versión para MUCHOS alumnos del mismo plan (ej. todos los de una cohorte): hace las consultas una sola vez
// en lugar de una por alumno. Devuelve [{ alumno, ctx }].
export const cargarContextosDeAlumnos = async (alumnos, { plan, materias, ahora = new Date() }) => {
    const ids = alumnos.map(a => a.id);

    const [historial, correlativas, intentosFinal, periodosFinal] = await Promise.all([
        HistorialAcademico.find({ alumno_id: { $in: ids } }).lean(),
        Correlatividad.find({ materia_id: { $in: materias.map(m => m.id) } }).lean(),
        InscripcionFinal.find({ alumno_id: { $in: ids } }).lean(),
        cargarPeriodosFinal()
    ]);

    return alumnos.map(alumno => ({
        alumno,
        ctx: crearContexto({
            historial: historial.filter(h => h.alumno_id === alumno.id),
            correlativas,
            intentosFinal: intentosFinal.filter(f => f.alumno_id === alumno.id),
            periodosFinal,
            materias,
            plan,
            ahora
        })
    }));
};
