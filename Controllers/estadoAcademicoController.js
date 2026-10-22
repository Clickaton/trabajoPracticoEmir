// Estado académico (solo lectura): la vista consolidada de un alumno (materias del plan, regularidad, semáforo,
// porcentaje de carrera) y el semáforo de toda una cohorte. Las reglas viven en reglasAcademicasService.
import Alumno from '../models/Alumno.js';
import Cohorte from '../models/Cohorte.js';
import PlanEstudio from '../models/PlanEstudio.js';
import { materiasDelPlan } from '../services/planService.js';
import { cargarContextoAcademico, cargarContextosDeAlumnos } from '../services/contextoAcademicoService.js';
import { estadoAcademicoDelAlumno } from '../services/reglasAcademicasService.js';
import { compararTexto } from '../utils/ordenarMaterias.js';

const COLORES = ['verde', 'amarillo', 'rojo', 'gris'];
// En el listado de una cohorte, primero los que necesitan atención
const GRAVEDAD = { rojo: 0, amarillo: 1, verde: 2, gris: 3 };

const verdadero = (valor) => valor === true || valor === 1 || ['true', '1', 'si', 'sí'].includes(String(valor).toLowerCase());

// ---------------------------------------------------------------------------
// GET /api/estado-academico/:alumnoId  (el propio alumno o un administrativo)
// Todas las materias de su plan con estado, nota, libro y folio, regularidad (cuántos llamados y ausentes le quedan,
// cuándo vence), semáforo y si puede rendir el final. El porcentaje cuenta las aprobadas y las promocionadas sin deudas.
// ---------------------------------------------------------------------------
export const getEstadoAcademico = async (req, res) => {
    try {
        const alumno = await Alumno.findOne({ id: parseInt(req.params.alumnoId) }).lean();
        if (!alumno) {
            return res.status(404).json({ error: "Alumno no encontrado" });
        }

        const { plan, materias, ctx } = await cargarContextoAcademico(alumno);
        const estado = estadoAcademicoDelAlumno(materias, ctx);

        res.json({
            alumno: alumno.name,
            plan: plan ? { id: plan.id, nombre: plan.nombre } : null,
            // Las reglas vigentes del plan (null = sin límite), para mostrárselas al alumno
            reglas: { vencimientoRegularidadMeses: ctx.meses, maxLlamadosConsecutivos: ctx.maxLlamados, maxAusentes: ctx.maxAusentes },
            porcentaje_carrera: `${estado.porcentaje}%`,
            materiasAprobadas: estado.materiasAprobadas,
            totalMaterias: estado.totalMaterias,
            semaforo: estado.semaforo,
            alertas: estado.alertas,
            materias: estado.materias,
            usuario: { name: alumno.name }
        });
    } catch (error) {
        console.error('[estado-academico] getEstadoAcademico:', error);
        res.status(500).json({ error: "Error interno del servidor al calcular el estado académico" });
    }
};

// ---------------------------------------------------------------------------
// GET /api/estado-academico/cohorte/:cohorteId/semaforo  (administrativos)
// El semáforo de cada alumno de la cohorte (el peor color de sus materias) y qué materias lo causan:
//   rojo = perdió la regularidad de alguna materia, amarillo = promoción condicional (debe el final de una correlativa),
//   verde = al día, gris = todavía no cursó nada.
// Filtros: ?color=rojo|amarillo|verde|gris   ?soloActivos=true   ?detalle=true (suma el detalle de cada materia)
//          ?orden=nombre (por defecto: primero los que necesitan atención)
// ---------------------------------------------------------------------------
export const getSemaforoCohorte = async (req, res) => {
    try {
        const cohorteId = parseInt(req.params.cohorteId);
        const cohorte = await Cohorte.findOne({ id: cohorteId }).lean();
        if (!cohorte) return res.status(404).json({ error: "Cohorte no encontrada" });

        const color = req.query.color;
        if (color !== undefined && !COLORES.includes(color)) {
            return res.status(400).json({ error: `El color debe ser uno de: ${COLORES.join(', ')}` });
        }

        if (cohorte.plan_id === undefined || cohorte.plan_id === null) {
            return res.status(409).json({ error: "La cohorte no tiene un plan de estudios asignado" });
        }
        const plan = await PlanEstudio.findOne({ id: cohorte.plan_id }).lean();
        if (!plan) return res.status(409).json({ error: `El plan de estudios ${cohorte.plan_id} de la cohorte no existe` });

        const materias = await materiasDelPlan(plan.id);
        let alumnos = await Alumno.find({ cohorte_id: cohorteId }).lean();
        if (verdadero(req.query.soloActivos)) alumnos = alumnos.filter(a => a.activo !== false);

        const contextos = await cargarContextosDeAlumnos(alumnos, { plan, materias });
        const detalle = verdadero(req.query.detalle);

        let filas = contextos.map(({ alumno, ctx }) => {
            const estado = estadoAcademicoDelAlumno(materias, ctx);
            return {
                alumno_id: alumno.id,
                alumno: alumno.name,
                dni: alumno.dni,
                legajo: alumno.legajo,
                activo: alumno.activo !== false,
                semaforo: estado.semaforo.color,
                conteo: estado.semaforo.conteo,
                porcentaje_carrera: `${estado.porcentaje}%`,
                materiasAprobadas: estado.materiasAprobadas,
                totalMaterias: estado.totalMaterias,
                alertas: estado.alertas,
                ...(detalle ? { materias: estado.materias } : {})
            };
        });

        // El resumen es de toda la cohorte aunque se filtre la lista
        const resumen = { verde: 0, amarillo: 0, rojo: 0, gris: 0 };
        for (const fila of filas) resumen[fila.semaforo] += 1;

        if (color) filas = filas.filter(f => f.semaforo === color);
        filas.sort(req.query.orden === 'nombre'
            ? (a, b) => compararTexto(a.alumno, b.alumno)
            : (a, b) => GRAVEDAD[a.semaforo] - GRAVEDAD[b.semaforo] || compararTexto(a.alumno, b.alumno));

        res.json({
            message: `Semáforo de la cohorte ${cohorte.name}`,
            cohorte: { id: cohorte.id, name: cohorte.name },
            plan: { id: plan.id, nombre: plan.nombre },
            totalAlumnos: contextos.length,
            resumen,
            data: filas
        });
    } catch (error) {
        console.error('[estado-academico] getSemaforoCohorte:', error);
        res.status(500).json({ error: "Error interno del servidor al calcular el semáforo de la cohorte" });
    }
};

export default { getEstadoAcademico, getSemaforoCohorte };
