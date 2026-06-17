import Cohorte from '../models/Cohorte.js';
import Alumno from '../models/Alumno.js'; // Importamos Alumno para poder cruzar los datos

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
        const { id, name, startDate, userList = [] } = req.body; 

        if (!id || !name || !startDate) { 
            return res.status(400).json({ error: "Faltan datos obligatorios" });
        }

        const nuevoCohorte = await Cohorte.create({
            id: parseInt(id),
            name,
            startDate,
            userList
        });

        res.status(201).json({ message: 'Cohorte creado exitosamente', cohorte: nuevoCohorte });
    } catch (error) {
        if (error.code === 11000) return res.status(400).json({ error: "El ID de la cohorte ya existe" });
        res.status(500).json({ error: "Error al crear la cohorte" });
    }
};

export const updateCohorte = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, startDate } = req.body;

        const datosAActualizar = {};
        if (name) datosAActualizar.name = name;
        if (startDate) datosAActualizar.startDate = startDate;

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