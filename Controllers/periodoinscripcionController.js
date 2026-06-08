import PeriodoInscripcion from '../models/PeriodoInscripcion.js';

// Obtener todos los períodos (Para el panel del Admin)
export const getPeriodos = async (req, res) => {
    try {
        const lista = await PeriodoInscripcion.find().lean();
        res.json({ message: 'Lista histórica de períodos de inscripción', data: lista });
    } catch (error) {
        res.status(500).json({ error: "Error al obtener los períodos de inscripción" });
    }
};

// Obtener SOLO los períodos activos y que estén vigentes en fecha y hora
export const getPeriodosActivos = async (req, res) => {
    try {
        const ahora = new Date();

        // 1. Buscamos los que el Admin dejó marcados como activos en la BD
        const periodosBBDD = await PeriodoInscripcion.find({ activo: true }).lean();

        // 2. Filtramos dinámicamente comparando con el reloj del servidor
        const periodosVigentes = periodosBBDD.filter(p => {
            // Creamos un objeto de fecha completo para el inicio (Fecha + Hora)
            const inicio = new Date(p.fechaInicio);
            const [horaIn, minIn] = p.horaInicio.split(':');
            inicio.setHours(parseInt(horaIn), parseInt(minIn), 0, 0);

            // Creamos un objeto de fecha completo para el fin (Fecha + Hora)
            const fin = new Date(p.fechaFin);
            const [horaFin, minFin] = p.horaFin.split(':');
            fin.setHours(parseInt(horaFin), parseInt(minFin), 0, 0);

            // El período solo es válido si el momento actual está entre el inicio y el fin
            return ahora >= inicio && ahora <= fin;
        });

        if (periodosVigentes.length === 0) {
            return res.json({ message: 'Inscripciones cerradas (no hay períodos vigentes en esta fecha)', data: [] });
        }

        res.json({ message: 'Períodos de inscripción abiertos actualmente', data: periodosVigentes });
    } catch (error) {
        res.status(500).json({ error: "Error al verificar períodos activos" });
    }
};

// Obtener un período por ID
export const getPeriodoById = async (req, res) => {
    try {
        const { id } = req.params;
        const periodo = await PeriodoInscripcion.findOne({ id: parseInt(id) }).lean();

        if (!periodo) return res.status(404).json({ error: "Período de inscripción no encontrado" });

        res.json({ message: `Detalles del período ID: ${id}`, data: periodo });
    } catch (error) {
        res.status(500).json({ error: "Error al obtener el período de inscripción" });
    }
};

// Crear un nuevo período (Soporta individual o masivo)
export const createPeriodo = async (req, res) => {
    try {
        const datos = req.body;

        // Soporte para carga masiva
        if (Array.isArray(datos)) {
            const nuevosPeriodos = await PeriodoInscripcion.insertMany(datos);
            return res.status(201).json({ message: 'Períodos creados masivamente', data: nuevosPeriodos });
        }

        // Carga individual
        const { id, nombre, fechaInicio, fechaFin, horaInicio, horaFin, activo } = datos;

        if (!id || !nombre || !fechaInicio || !fechaFin || !horaInicio || !horaFin) {
            return res.status(400).json({ error: "Faltan datos obligatorios" });
        }

        const nuevoPeriodo = await PeriodoInscripcion.create({
            id: parseInt(id),
            nombre,
            fechaInicio,
            fechaFin,
            horaInicio,
            horaFin,
            activo: activo !== undefined ? activo : false
        });

        res.status(201).json({ message: 'Período creado exitosamente', data: nuevoPeriodo });
    } catch (error) {
        if (error.code === 11000) return res.status(400).json({ error: "El ID del período ya existe" });
        res.status(500).json({ error: "Error al crear el período de inscripción" });
    }
};

// Actualizar un período (Acá el Admin prende o apaga las inscripciones)
export const updatePeriodo = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, fechaInicio, fechaFin, horaInicio, horaFin, activo } = req.body;

        const datosAActualizar = {};
        if (nombre) datosAActualizar.nombre = nombre;
        if (fechaInicio) datosAActualizar.fechaInicio = fechaInicio;
        if (fechaFin) datosAActualizar.fechaFin = fechaFin;
        if (horaInicio) datosAActualizar.horaInicio = horaInicio;
        if (horaFin) datosAActualizar.horaFin = horaFin;
        if (activo !== undefined) datosAActualizar.activo = activo;

        const periodoActualizado = await PeriodoInscripcion.findOneAndUpdate(
            { id: parseInt(id) },
            datosAActualizar,
            { new: true }
        );

        if (!periodoActualizado) return res.status(404).json({ error: "Período no encontrado" });
        res.json({ message: "Período actualizado", data: periodoActualizado });
    } catch (error) {
        res.status(500).json({ error: "Error al actualizar el período" });
    }
};

// Eliminar un período
export const deletePeriodo = async (req, res) => {
    try {
        const { id } = req.params;
        const eliminado = await PeriodoInscripcion.findOneAndDelete({ id: parseInt(id) });

        if (!eliminado) return res.status(404).json({ error: "Período no encontrado" });
        res.json({ message: "Período eliminado", data: eliminado });
    } catch (error) {
        res.status(500).json({ error: "Error al eliminar el período" });
    }
};

export default {
    getPeriodos,
    getPeriodosActivos,
    getPeriodoById,
    createPeriodo,
    updatePeriodo,
    deletePeriodo
};