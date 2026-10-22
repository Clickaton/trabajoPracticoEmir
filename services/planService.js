// Acceso a datos relacionado con los planes de estudio (a diferencia de reglasAcademicasService, este SÍ consulta la base).
import PlanEstudio from '../models/PlanEstudio.js';
import Cohorte from '../models/Cohorte.js';
import Materia from '../models/Materia.js';
import { ordenarMaterias } from '../utils/ordenarMaterias.js';

// Los planes creados antes del régimen de llamados no tienen los campos nuevos guardados en la base.
// Para mostrarlos (pantallas, API) se completan con los valores por defecto; las reglas ya hacen lo mismo por su cuenta.
export const conDefectos = (plan) => (plan ? {
    activo: true,
    duracionAnios: 3,
    vencimientoRegularidadMeses: 24,
    maxLlamadosConsecutivos: 8,
    maxAusentes: null,
    ...plan
} : plan);

// El plan de un alumno es el de su cohorte. Sin cohorte (o con una cohorte sin plan) devuelve null.
export const obtenerPlanDeAlumno = async (alumno) => {
    if (!alumno?.cohorte_id) return null;

    const cohorte = await Cohorte.findOne({ id: alumno.cohorte_id }).lean();
    if (!cohorte?.plan_id) return null;

    return PlanEstudio.findOne({ id: cohorte.plan_id }).lean();
};

// Materias de un plan, ya ordenadas por año y nombre. Sin plan => lista vacía.
export const materiasDelPlan = async (planId) => {
    if (planId === null || planId === undefined) return [];
    return ordenarMaterias(await Materia.find({ plan_id: planId }).lean());
};

// Valida el plan_id recibido en un alta. Devuelve { plan } o { error }.
// Compatibilidad: si no viene plan_id y existe UN solo plan, se usa ese (las pantallas viejas todavía no lo envían).
export const resolverPlanId = async (planIdRecibido) => {
    const vino = planIdRecibido !== undefined && planIdRecibido !== null && planIdRecibido !== '';

    if (vino) {
        const id = parseInt(planIdRecibido, 10);
        if (Number.isNaN(id)) return { error: 'El plan de estudios indicado no es válido' };

        const plan = await PlanEstudio.findOne({ id }).lean();
        if (!plan) return { error: `No existe el plan de estudios ${id}` };
        return { plan };
    }

    const planes = await PlanEstudio.find().lean();
    if (planes.length === 1) return { plan: planes[0] };
    if (planes.length === 0) return { error: 'Primero tenés que crear un plan de estudios' };
    return { error: 'Indicá a qué plan de estudios pertenece (plan_id)' };
};
