const PeriodoInscripcion = require('../models/PeriodoInscripcion.js');

// Base de datos temporal
let listaPeriodos = [
    new PeriodoInscripcion(1, 'Primer Cuatrimestre 2026', '2026-03-01', '2026-03-15', true),
    new PeriodoInscripcion(2, 'Segundo Cuatrimestre 2026', '2026-08-01', '2026-08-15', false)
];

// Obtener todos los períodos (Para el panel del Admin)
exports.getPeriodos = (req, res) => {
    res.json({ message: 'Lista histórica de períodos de inscripción', data: listaPeriodos });
};

// Obtener SOLO los períodos activos (IDEAL para el módulo Estudiantes)
exports.getPeriodosActivos = (req, res) => {
    const periodosActivos = listaPeriodos.filter(p => p.activo === true);
    res.json({ message: 'Períodos de inscripción abiertos actualmente', data: periodosActivos });
};

// Obtener un período por ID
exports.getPeriodoById = (req, res) => {
    const { id } = req.params;
    const periodo = listaPeriodos.find(p => p.id === parseInt(id));
    
    if (!periodo) {
        return res.status(404).json({ error: "Período de inscripción no encontrado" });
    }
    res.json({ message: `Detalles del período ID: ${id}`, data: periodo });
};

// Crear un nuevo período
exports.createPeriodo = (req, res) => {
    const { id, nombre, fechaInicio, fechaFin, activo } = req.body;

    // Validación estricta para evitar datos basura
    if (!id || !nombre || !fechaInicio || !fechaFin) {
        return res.status(400).json({ error: "Faltan datos obligatorios (id, nombre, fechaInicio, fechaFin)" });
    }

    // Si no mandan 'activo', por defecto es false (cerrado)
    const estadoActivo = activo !== undefined ? activo : false;
    
    const nuevoPeriodo = new PeriodoInscripcion(id, nombre, fechaInicio, fechaFin, estadoActivo);
    listaPeriodos.push(nuevoPeriodo);

    res.status(201).json({ message: 'Período creado exitosamente', data: nuevoPeriodo });
};

// Actualizar un período (Acá es donde el Admin "prende o apaga" las inscripciones)
exports.updatePeriodo = (req, res) => {
    const { id } = req.params;
    const { nombre, fechaInicio, fechaFin, activo } = req.body;

    const periodo = listaPeriodos.find(p => p.id === parseInt(id));
    if (!periodo) {
        return res.status(404).json({ error: "Período no encontrado" });
    }

    if (nombre) periodo.nombre = nombre;
    if (fechaInicio) periodo.fechaInicio = fechaInicio;
    if (fechaFin) periodo.fechaFin = fechaFin;
    // Chequeamos que no sea undefined para permitir enviar un false válido
    if (activo !== undefined) periodo.activo = activo;

    res.json({ message: "Período actualizado", data: periodo });
};

// Eliminar un período
exports.deletePeriodo = (req, res) => {
    const { id } = req.params;
    const index = listaPeriodos.findIndex(p => p.id === parseInt(id));
    
    if (index === -1) return res.status(404).json({ error: "Período no encontrado" });

    const [eliminado] = listaPeriodos.splice(index, 1);
    res.json({ message: "Período eliminado", data: eliminado });
};