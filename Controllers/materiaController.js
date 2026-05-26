import Materia from '../models/Materia.js'; 
import { getDB } from '../config/db.js';

const getCollection = () => getDB().collection('materias');

export const getMaterias = async (req, res) => {
    const listaMaterias = await getCollection().find().toArray();
    res.json({ message: 'Lista de materias', data: listaMaterias });
};

export const getMateriaById = async (req, res) => {
    const { id } = req.params;
    const materia = await getCollection().findOne({ id: parseInt(id) });
    if (!materia) {
        return res.status(404).json({ error: "Materia no encontrada" });
    }
    res.json({ message: `Detalles de la materia con ID: ${id}`, materia: materia });
};

export const createMateria = async (req, res) => {
    // Validamos usando las propiedades del modelo de Materia
    const { id, nombre, anio } = req.body;
    if (!id || !nombre || !anio) {
        return res.status(400).json({ error: "Faltan datos obligatorios" });
    }
    // Instanciamos usando el modelo importado
    const nuevaMateria = new Materia(id, nombre, anio);
    await getCollection().insertOne(nuevaMateria);
    res.json({ message: 'Materia creada exitosamente', materia: nuevaMateria });
};

export const updateMateria = async (req, res) => {
    const { id } = req.params;
    const { nombre, anio } = req.body;

    const updateData = {};
    if (nombre) updateData.nombre = nombre;
    if (anio) updateData.anio = anio;

    const result = await getCollection().updateOne({ id: parseInt(id) }, { $set: updateData });
    if (result.matchedCount === 0) return res.status(404).json({ error: "Materia no encontrada" });
    
    const materiaActualizada = await getCollection().findOne({ id: parseInt(id) });
    res.json({ message: "Materia actualizada", materia: materiaActualizada });
};

export const deleteMateria = async (req, res) => {
    const { id } = req.params;
    const eliminada = await getCollection().findOne({ id: parseInt(id) });
    if (!eliminada) return res.status(404).json({ error: "Materia no encontrada" });
    
    await getCollection().deleteOne({ id: parseInt(id) });
    res.json({ message: "Materia eliminada", materia: eliminada });
};