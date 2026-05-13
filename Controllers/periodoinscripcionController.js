import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import PeriodoInscripcion from '../models/PeriodoInscripcion.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const periodosFilePath = path.join(__dirname, '../data/periodoInscripcion.json');

const readPeriodos = async () => {
    const data = await fs.readFile(periodosFilePath, 'utf-8');
    return JSON.parse(data);
};

const writePeriodos = async (data) => {
    await fs.writeFile(periodosFilePath, JSON.stringify(data, null, 2));
};

// Obtener todos los períodos (Para el panel del Admin)
const getPeriodos = async (req, res) => {
    const lista = await readPeriodos();
    res.json({ message: 'Lista histórica de períodos de inscripción', data: lista });
};

// Obtener SOLO los períodos activos (Para el módulo Estudiantes)
const getPeriodosActivos = async (req, res) => {
    const lista = await readPeriodos();
    const periodosActivos = lista.filter(p => p.activo === true);

    if (periodosActivos.length === 0) {
        return res.json({ message: 'Inscripciones cerradas', data: [] });
    }

    res.json({ message: 'Períodos de inscripción abiertos actualmente', data: periodosActivos });
};

// Obtener un período por ID
const getPeriodoById = async (req, res) => {
    const { id } = req.params;
    const lista = await readPeriodos();
    const periodo = lista.find(p => p.id === parseInt(id));

    if (!periodo) return res.status(404).json({ error: "Período de inscripción no encontrado" });

    res.json({ message: `Detalles del período ID: ${id}`, data: periodo });
};

// Crear un nuevo período
const createPeriodo = async (req, res) => {
    const { id, nombre, fechaInicio, fechaFin, horaInicio, horaFin, activo } = req.body;

    if (!id || !nombre || !fechaInicio || !fechaFin || !horaInicio || !horaFin) {
        return res.status(400).json({ error: "Faltan datos obligatorios (id, nombre, fechaInicio, fechaFin, horaInicio, horaFin)" });
    }

    const lista = await readPeriodos();
    const nuevoPeriodo = new PeriodoInscripcion(
        parseInt(id),
        nombre,
        fechaInicio,
        fechaFin,
        horaInicio,
        horaFin,
        activo !== undefined ? activo : false
    );
    lista.push(nuevoPeriodo);
    await writePeriodos(lista);

    res.status(201).json({ message: 'Período creado exitosamente', data: nuevoPeriodo });
};

// Actualizar un período (acá el Admin prende o apaga las inscripciones)
const updatePeriodo = async (req, res) => {
    const { id } = req.params;
    const { nombre, fechaInicio, fechaFin, horaInicio, horaFin, activo } = req.body;

    const lista = await readPeriodos();
    const periodo = lista.find(p => p.id === parseInt(id));
    if (!periodo) return res.status(404).json({ error: "Período no encontrado" });

    if (nombre) periodo.nombre = nombre;
    if (fechaInicio) periodo.fechaInicio = fechaInicio;
    if (fechaFin) periodo.fechaFin = fechaFin;
    if (horaInicio) periodo.horaInicio = horaInicio;
    if (horaFin) periodo.horaFin = horaFin;
    if (activo !== undefined) periodo.activo = activo;

    await writePeriodos(lista);
    res.json({ message: "Período actualizado", data: periodo });
};

// Eliminar un período
const deletePeriodo = async (req, res) => {
    const { id } = req.params;
    const lista = await readPeriodos();
    const index = lista.findIndex(p => p.id === parseInt(id));

    if (index === -1) return res.status(404).json({ error: "Período no encontrado" });

    const [eliminado] = lista.splice(index, 1);
    await writePeriodos(lista);
    res.json({ message: "Período eliminado", data: eliminado });
};

export default {
    getPeriodos,
    getPeriodosActivos,
    getPeriodoById,
    createPeriodo,
    updatePeriodo,
    deletePeriodo
};