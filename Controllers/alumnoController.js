import Alumno from '../models/Alumno.js';
import { getDB } from '../config/db.js';

const getCollection = () => getDB().collection('alumnos');

// Función helper para omitir la contraseña en las respuestas y no repetir código.
const omitPassword = (alumno) => {
    const { password, ...alumnoSinPassword } = alumno;
    return alumnoSinPassword;
};

export const getAlumnos = async (req, res) => {
    const listaAlumnos = await getCollection().find().toArray();
    const alumnosSinPassword = listaAlumnos.map(omitPassword);
    res.json({ message: 'Lista de alumnos', data: alumnosSinPassword });
};

export const getAlumnoById = async (req, res) => {
    const { id } = req.params;
    const alumno = await getCollection().findOne({ id: parseInt(id) });
    if (!alumno) {
        return res.status(404).json({ error: "Alumno no encontrado" });
    }
    res.json({ message:` Detalles del alumno con ID: ${id}`, data: omitPassword(alumno) });
};

export const createAlumno = async (req, res) => {
    const { id, name, email, password, legajo, activo, fecha_inscripcion } = req.body;

    if (!id || !name || !email || !password || !legajo || activo === undefined || !fecha_inscripcion) {
        return res.status(400).json({ error: "Faltan datos obligatorios (id, name, email, password, legajo, activo, fecha_inscripcion)" });
    }

    // Hashear la contraseña antes de guardarla.
    const nuevoAlumno = new Alumno(id, name, email, password, legajo, activo, new Date(fecha_inscripcion));
    await getCollection().insertOne(nuevoAlumno);

    res.status(201).json({ message: 'Alumno creado exitosamente', data: omitPassword(nuevoAlumno) });
};

export const updateAlumno = async (req, res) => {
    const { id } = req.params;
    const { name, email, password, legajo, activo, fecha_inscripcion } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (password) updateData.password = password; 
    if (legajo) updateData.legajo = legajo;
    if (activo !== undefined) updateData.activo = activo;
    if (fecha_inscripcion) updateData.fecha_inscripcion = new Date(fecha_inscripcion);

    const result = await getCollection().updateOne({ id: parseInt(id) }, { $set: updateData });
    if (result.matchedCount === 0) return res.status(404).json({ error: "Alumno no encontrado" });

    const alumnoActualizado = await getCollection().findOne({ id: parseInt(id) });
    res.json({ message: "Alumno actualizado", data: omitPassword(alumnoActualizado) });
};

export const deleteAlumno = async (req, res) => {
    const { id } = req.params;
    const eliminado = await getCollection().findOne({ id: parseInt(id) });
    if (!eliminado) return res.status(404).json({ error: "Alumno no encontrado" });
    
    await getCollection().deleteOne({ id: parseInt(id) });
    res.json({ message: "Alumno eliminado", data: omitPassword(eliminado) });
};