import Cohorte from '../models/Cohorte.js';
import Alumno from '../models/Alumno.js'; // Importamos Alumno para poder cruzar los datos
import HistorialAcademico from '../models/HistorialAcademico.js';
import Inscripcion from '../models/Inscripcion.js';
import { parseLocalDate } from '../utils/dateUtils.js';
import { resolverPlanId } from '../services/planService.js';

// Helper para limpiar la contraseña al devolver los datos del alumno
const omitPassword = (alumnoObj) => {
    const { password, ...resto } = alumnoObj;
    return resto;
};

export const getCohortes = async (req, res) => {
    try {
        const cohortes = await Cohorte.find();
        
        // Mapeamos las cohortes para "poblar" el userList con datos reales
        const cohortesPobladas = await Promise.all(cohortes.map(async (c) => {
            // Buscamos a todos los alumnos que tengan su ID dentro de esta lista
            const alumnos = await Alumno.find({ id: { $in: c.userList } }).lean();
            
            return {
                ...c.toObject(),
                userList: alumnos.map(omitPassword)
            };
        }));

        res.json({ message: 'Lista de cohortes', data: cohortesPobladas });
    } catch (error) {
        res.status(500).json({ error: "Error obteniendo cohortes" });
    }
};

export const getCohorteById = async (req, res) => {
    try {
        const { id } = req.params;
        const cohorte = await Cohorte.findOne({ id: parseInt(id) }).lean();
        
        if (!cohorte) return res.status(404).json({ error: "Cohorte no encontrado" });

        const alumnos = await Alumno.find({ id: { $in: cohorte.userList } }).lean();
        cohorte.userList = alumnos.map(omitPassword);

        res.json({ message: 'Detalle del cohorte', data: cohorte });
    } catch (error) {
        res.status(500).json({ error: "Error obteniendo el cohorte" });
    }
};

export const createCohorte = async (req, res) => {
    try {
        const { name, startDate, userList = [], plan_id } = req.body; 

        if (!name || !startDate) { 
            return res.status(400).json({ error: "Faltan datos obligatorios" });
        }

        // Toda cohorte cursa un plan de estudios. Si hay un único plan y no se indica, se usa ese.
        const { plan, error } = await resolverPlanId(plan_id);
        if (error) return res.status(400).json({ error });
        if (plan.activo === false) {
            return res.status(400).json({ error: `El plan "${plan.nombre}" está dado de baja y no admite nuevas cohortes` });
        }

        const nuevoCohorte = await Cohorte.create({
            name,
            startDate: parseLocalDate(startDate),
            userList,
            plan_id: plan.id
        });

        res.status(201).json({ message: 'Cohorte creado exitosamente', cohorte: nuevoCohorte });
    } catch (error) {
        // Antes se llamaba a un `next` inexistente y la petición quedaba colgada / devolvía HTML
        res.status(500).json({ error: "Error creando la cohorte" });
    }
};

export const updateCohorte = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, startDate, plan_id } = req.body;

        const datosAActualizar = {};
        if (name) datosAActualizar.name = name;
        if (startDate) datosAActualizar.startDate = parseLocalDate(startDate);

        if (plan_id !== undefined && plan_id !== null && plan_id !== '') {
            const actual = await Cohorte.findOne({ id: parseInt(id) }).lean();
            if (!actual) return res.status(404).json({ error: "Cohorte no encontrado" });

            if (Number(plan_id) !== actual.plan_id) {
                const { plan, error } = await resolverPlanId(plan_id);
                if (error) return res.status(400).json({ error });
                if (plan.activo === false) {
                    return res.status(400).json({ error: `El plan "${plan.nombre}" está dado de baja` });
                }

                // Cambiar el plan de una cohorte que ya tiene cursadas o inscripciones dejaría el historial
                // apuntando a materias de otro plan. Solo se permite mientras todavía no hay actividad.
                if (actual.plan_id !== null && actual.plan_id !== undefined) {
                    const conHistorial = await HistorialAcademico.exists({ alumno_id: { $in: actual.userList } });
                    const conInscripciones = await Inscripcion.exists({ cohorte_id: actual.id });
                    if (conHistorial || conInscripciones) {
                        return res.status(409).json({ error: "No se puede cambiar el plan de una cohorte que ya tiene alumnos cursando o inscriptos. Creá una cohorte nueva con el otro plan." });
                    }
                }
                datosAActualizar.plan_id = plan.id;
            }
        }

        const cohorteActualizado = await Cohorte.findOneAndUpdate(
            { id: parseInt(id) },
            datosAActualizar,
            { new: true }
        );

        if (!cohorteActualizado) return res.status(404).json({ error: "Cohorte no encontrado" });
        res.json({ message: "Cohorte actualizado", cohorte: cohorteActualizado });
    } catch (error) {
        res.status(500).json({ error: "Error al actualizar cohorte" });
    }
};

export const deleteCohorte = async (req, res) => {
    try {
        const { id } = req.params;
        const eliminado = await Cohorte.findOneAndDelete({ id: parseInt(id) });
        
        if (!eliminado) return res.status(404).json({ error: "Cohorte no encontrado" });

        // Opcional: Al borrar la cohorte, le quitamos el cohorte_id a los alumnos que estaban en ella
        await Alumno.updateMany({ id: { $in: eliminado.userList } }, { cohorte_id: null });

        res.json({ message: "Cohorte eliminada", cohorte: eliminado });
    } catch (error) {
        res.status(500).json({ error: "Error al eliminar cohorte" });
    }
};

export const addUserToCohorte = async (req, res) => {
    try {
        const { cohorteId } = req.params;
        const { alumnoId } = req.body;

        const cohorte = await Cohorte.findOne({ id: parseInt(cohorteId) });
        if (!cohorte) return res.status(404).json({ error: "Cohorte no encontrado" });

        const alumno = await Alumno.findOne({ id: parseInt(alumnoId) });
        if (!alumno) return res.status(404).json({ error: "Alumno no encontrado" });

        if (cohorte.userList.includes(parseInt(alumnoId))) {
            return res.status(400).json({ error: "El alumno ya pertenece a este cohorte" });
        }

        // Pasar a un alumno con historial a una cohorte de OTRO plan mezclaría materias de dos planes
        if (alumno.cohorte_id && alumno.cohorte_id !== cohorte.id) {
            const anterior = await Cohorte.findOne({ id: alumno.cohorte_id }).lean();
            const planAnterior = anterior?.plan_id ?? null;
            if (planAnterior !== null && planAnterior !== (cohorte.plan_id ?? null)
                && await HistorialAcademico.exists({ alumno_id: alumno.id })) {
                return res.status(409).json({ error: "El alumno ya tiene historial en otro plan de estudios y no puede pasar a una cohorte de un plan distinto." });
            }
        }

        // 1. Agregamos el alumno a la cohorte
        cohorte.userList.push(parseInt(alumnoId));
        await cohorte.save();

        // 2. Le asignamos la cohorte al alumno (La doble relación)
        alumno.cohorte_id = cohorte.id;
        await alumno.save();

        res.json({ message: "Alumno agregado al cohorte exitosamente" });
    } catch (error) {
        res.status(500).json({ error: "Error interno al agregar alumno" });
    }
};

export const removeUserFromCohorte = async (req, res) => {
    try {
        const { cohorteId } = req.params;
        const { alumnoId } = req.body;

        const cohorte = await Cohorte.findOne({ id: parseInt(cohorteId) });
        if (!cohorte) return res.status(404).json({ error: "Cohorte no encontrado" });

        const index = cohorte.userList.indexOf(parseInt(alumnoId));
        if (index === -1) return res.status(404).json({ error: "Alumno no encontrado en este cohorte" });

        // 1. Removemos al alumno de la lista
        cohorte.userList.splice(index, 1);
        await cohorte.save();

        // 2. Le quitamos la cohorte al alumno
        await Alumno.findOneAndUpdate({ id: parseInt(alumnoId) }, { cohorte_id: null });

        res.json({ message: "Alumno eliminado del cohorte" });
    } catch (error) {
        res.status(500).json({ error: "Error interno al remover alumno" });
    }
};

export const getUsersInCohorte = async (req, res) => {
    try {
        const { cohorteId } = req.params;
        const cohorte = await Cohorte.findOne({ id: parseInt(cohorteId) });
        
        if (!cohorte) return res.status(404).json({ error: "Cohorte no encontrado" });

        const alumnos = await Alumno.find({ id: { $in: cohorte.userList } }).lean();
        
        res.json({ message: "Lista de alumnos en el cohorte", users: alumnos.map(omitPassword) });
    } catch (error) {
        res.status(500).json({ error: "Error al obtener alumnos de la cohorte" });
    }
};

export default {
    getCohortes,
    getCohorteById,
    createCohorte,
    updateCohorte,
    deleteCohorte,
    addUserToCohorte,
    removeUserFromCohorte,
    getUsersInCohorte
}; 