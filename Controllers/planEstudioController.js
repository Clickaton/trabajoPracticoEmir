import PlanEstudio from '../models/PlanEstudio.js';
import Materia from '../models/Materia.js';
import Cohorte from '../models/Cohorte.js';
import { conDefectos } from '../services/planService.js';

// "", null o undefined => null; cualquier otro valor => número
const aNumeroONull = (valor) => (valor === '' || valor === null || valor === undefined ? null : Number(valor));

// Valida y normaliza los datos de un plan. Con parcial = true solo se validan los campos que llegaron (para PUT).
const validarPlan = (datos, { parcial = false } = {}) => {
    const errores = [];
    const limpio = {};

    if (!parcial || datos.nombre !== undefined) {
        const nombre = String(datos.nombre ?? '').trim();
        if (!nombre) errores.push('El nombre del plan es obligatorio');
        else limpio.nombre = nombre;
    }

    if (datos.resolucion !== undefined) limpio.resolucion = String(datos.resolucion ?? '').trim();

    if (datos.duracionAnios !== undefined) {
        const n = aNumeroONull(datos.duracionAnios);
        if (!Number.isInteger(n) || n < 1 || n > 10) errores.push('La duración debe ser un número entero de años entre 1 y 10');
        else limpio.duracionAnios = n;
    }

    if (datos.activo !== undefined) limpio.activo = datos.activo === true || datos.activo === 'true';

    if (datos.vencimientoRegularidadMeses !== undefined) {
        // Vacío = la regularidad no vence por tiempo (rigen solo los llamados y las ausencias)
        const n = aNumeroONull(datos.vencimientoRegularidadMeses);
        if (n !== null && (!Number.isInteger(n) || n < 1 || n > 240)) errores.push('El vencimiento de regularidad debe ser un número entero de meses entre 1 y 240 (dejalo vacío si no vence por tiempo)');
        else limpio.vencimientoRegularidadMeses = n;
    }

    if (datos.maxLlamadosConsecutivos !== undefined) {
        const n = aNumeroONull(datos.maxLlamadosConsecutivos);
        if (n !== null && (!Number.isInteger(n) || n < 1 || n > 50)) errores.push('El máximo de llamados consecutivos debe ser un entero entre 1 y 50 (dejalo vacío si no hay tope)');
        else limpio.maxLlamadosConsecutivos = n;
    }

    if (datos.maxAusentes !== undefined) {
        const n = aNumeroONull(datos.maxAusentes);
        if (n !== null && (!Number.isInteger(n) || n < 1 || n > 50)) errores.push('El máximo de ausentes debe ser un entero entre 1 y 50 (dejalo vacío si no hay tope)');
        else limpio.maxAusentes = n;
    }

    return { errores, limpio };
};

export const getPlanes = async (req, res) => {
    try {
        const [planes, materiasPorPlan, cohortesPorPlan] = await Promise.all([
            PlanEstudio.find().sort({ id: 1 }).lean(),
            Materia.aggregate([{ $group: { _id: '$plan_id', total: { $sum: 1 } } }]),
            Cohorte.aggregate([{ $group: { _id: '$plan_id', total: { $sum: 1 } } }])
        ]);

        const aMapa = (grupos) => new Map(grupos.map(g => [g._id, g.total]));
        const materias = aMapa(materiasPorPlan);
        const cohortes = aMapa(cohortesPorPlan);

        const data = planes.map(p => ({
            ...conDefectos(p),
            totalMaterias: materias.get(p.id) ?? 0,
            totalCohortes: cohortes.get(p.id) ?? 0
        }));

        res.json({ message: 'Lista de planes de estudio', data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error obteniendo los planes de estudio" });
    }
};

export const getPlanById = async (req, res) => {
    try {
        const plan = await PlanEstudio.findOne({ id: parseInt(req.params.id) }).lean();
        if (!plan) return res.status(404).json({ error: "Plan de estudios no encontrado" });

        res.json({ message: `Detalle del plan ${plan.id}`, data: conDefectos(plan) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error obteniendo el plan de estudios" });
    }
};

export const createPlan = async (req, res) => {
    try {
        const { errores, limpio } = validarPlan(req.body ?? {});
        if (errores.length > 0) return res.status(400).json({ error: errores.join('. ') });

        const nuevoPlan = await PlanEstudio.create(limpio);
        res.status(201).json({ message: 'Plan de estudios creado exitosamente', data: nuevoPlan });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error creando el plan de estudios" });
    }
};

// Cambiar vencimientoRegularidadMeses, maxLlamadosConsecutivos o maxAusentes se aplica enseguida a todos los alumnos
// del plan, porque el vencimiento no se guarda: se calcula al consultar.
export const updatePlan = async (req, res) => {
    try {
        const { errores, limpio } = validarPlan(req.body ?? {}, { parcial: true });
        if (errores.length > 0) return res.status(400).json({ error: errores.join('. ') });
        if (Object.keys(limpio).length === 0) return res.status(400).json({ error: "No se enviaron datos para actualizar" });

        const planActualizado = await PlanEstudio.findOneAndUpdate(
            { id: parseInt(req.params.id) },
            limpio,
            { new: true, runValidators: true }
        );

        if (!planActualizado) return res.status(404).json({ error: "Plan de estudios no encontrado" });
        res.json({ message: "Plan de estudios actualizado", data: planActualizado });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error actualizando el plan de estudios" });
    }
};

export const deletePlan = async (req, res) => {
    try {
        const id = parseInt(req.params.id);

        const plan = await PlanEstudio.findOne({ id }).lean();
        if (!plan) return res.status(404).json({ error: "Plan de estudios no encontrado" });

        const [totalMaterias, totalCohortes] = await Promise.all([
            Materia.countDocuments({ plan_id: id }),
            Cohorte.countDocuments({ plan_id: id })
        ]);

        if (totalMaterias > 0 || totalCohortes > 0) {
            return res.status(409).json({
                error: `No se puede eliminar el plan: tiene ${totalMaterias} materia(s) y ${totalCohortes} cohorte(s). Si ya no se usa, desactivalo en lugar de borrarlo.`
            });
        }

        await PlanEstudio.findOneAndDelete({ id });
        res.json({ message: "Plan de estudios eliminado", data: plan });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error eliminando el plan de estudios" });
    }
};

export default {
    getPlanes,
    getPlanById,
    createPlan,
    updatePlan,
    deletePlan
};
