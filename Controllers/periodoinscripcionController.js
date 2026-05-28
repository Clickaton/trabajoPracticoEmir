import PeriodoInscripcion from '../models/PeriodoInscripcion.js';
import { getDB } from '../config/db.js';

const getCollection = () => getDB().collection('periodos_inscripcion');

// Obtener todos los períodos (Para el panel del Admin)
export const getPeriodos = async (req, res) => {
    const listaPeriodos = await getCollection().find().toArray();
    res.json({ message: 'Lista histórica de períodos de inscripción', data: listaPeriodos });
};

// Obtener SOLO los períodos activos (IDEAL para el módulo Estudiantes)
export const getPeriodosActivos = async (req, res) => {
    const periodosActivos = await getCollection().find({ activo: true }).toArray();
    res.json({ message: 'Períodos de inscripción abiertos actualmente', data: periodosActivos });
};

// Obtener un período por ID
export const getPeriodoById = async (req, res) => {
    const { id } = req.params;
    const periodo = await getCollection().findOne({ id: parseInt(id) });
    
    if (!periodo) return res.status(404).json({ error: "Período de inscripción no encontrado" });
    
    res.json({ message: `Detalles del período ID: ${id}`, data: periodo });
};

// Crear un nuevo período
export const createPeriodo = async (req, res) => {
    const { id, nombre, fechaInicio, fechaFin, activo } = req.body;

    if (!id || !nombre || !fechaInicio || !fechaFin) {
        return res.status(400).json({ error: "Faltan datos obligatorios (id, nombre, fechaInicio, fechaFin)" });
    }

    const estadoActivo = activo !== undefined ? activo : false;
    const nuevoPeriodo = new PeriodoInscripcion(parseInt(id), nombre, fechaInicio, fechaFin, estadoActivo);
    
    await getCollection().insertOne(nuevoPeriodo);

    res.status(201).json({ message: 'Período creado exitosamente', data: nuevoPeriodo });
};

// Actualizar un período (Acá es donde el Admin "prende o apaga" las inscripciones)
export const updatePeriodo = async (req, res) => {
    const { id } = req.params;
    const { nombre, fechaInicio, fechaFin, activo } = req.body;

    const updateData = {};
    if (nombre) updateData.nombre = nombre;
    if (fechaInicio) updateData.fechaInicio = fechaInicio;
    if (fechaFin) updateData.fechaFin = fechaFin;
    if (activo !== undefined) updateData.activo = activo;

    const result = await getCollection().updateOne({ id: parseInt(id) }, { $set: updateData });
    if (result.matchedCount === 0) return res.status(404).json({ error: "Período no encontrado" });

    const periodoActualizado = await getCollection().findOne({ id: parseInt(id) });
    res.json({ message: "Período actualizado", data: periodoActualizado });
};

// Eliminar un período
export const deletePeriodo = async (req, res) => {
    const { id } = req.params;
    const eliminado = await getCollection().findOne({ id: parseInt(id) });
    
    if (!eliminado) return res.status(404).json({ error: "Período no encontrado" });

    await getCollection().deleteOne({ id: parseInt(id) });
    res.json({ message: "Período eliminado", data: eliminado });
};