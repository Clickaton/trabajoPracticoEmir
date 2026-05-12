import Alumno from '../models/Alumno.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const alumnosFilePath = path.join(__dirname, '../data/alumnos.json');

const readAlumnos = async () => {
    const data = await fs.readFile(alumnosFilePath, 'utf-8');
    return JSON.parse(data);
};

const writeAlumnos = async (data) => {
    await fs.writeFile(alumnosFilePath, JSON.stringify(data, null, 2));
};

// Función helper para omitir la contraseña en las respuestas y no repetir código.
const omitPassword = (alumno) => {
    const { password, ...alumnoSinPassword } = alumno;
    return alumnoSinPassword;
};

export const getAlumnos = async (req, res) => {
    const listaAlumnos = await readAlumnos();
    const alumnosSinPassword = listaAlumnos.map(omitPassword);
    res.json({ message: 'Lista de alumnos', data: alumnosSinPassword });
};

export const getAlumnoById = async (req, res) => {
    const { id } = req.params;
    const listaAlumnos = await readAlumnos();
    const alumno = listaAlumnos.find(a => a.id === parseInt(id));
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

    const listaAlumnos = await readAlumnos();
    // Hashear la contraseña antes de guardarla.
    const nuevoAlumno = new Alumno(id, name, email, password, legajo, activo, new Date(fecha_inscripcion));
    listaAlumnos.push(nuevoAlumno);
    await writeAlumnos(listaAlumnos);

    res.status(201).json({ message: 'Alumno creado exitosamente', data: omitPassword(nuevoAlumno) });
};

export const updateAlumno = async (req, res) => {
    const { id } = req.params;
    const { name, email, password, legajo, activo, fecha_inscripcion } = req.body;

    let listaAlumnos = await readAlumnos();
    const alumno = listaAlumnos.find(a => a.id === parseInt(id));
    if (!alumno) {
        return res.status(404).json({ error: "Alumno no encontrado" });
    }

    if (name) alumno.name = name;
    if (email) alumno.email = email;
    if (password) alumno.password = password; 
    if (legajo) alumno.legajo = legajo;
    if (activo !== undefined) alumno.activo = activo;
    if (fecha_inscripcion) alumno.fecha_inscripcion = new Date(fecha_inscripcion);

    await writeAlumnos(listaAlumnos);

    res.json({ message: "Alumno actualizado", data: omitPassword(alumno) });
};

export const deleteAlumno = async (req, res) => {
    const { id } = req.params;
    let listaAlumnos = await readAlumnos();
    const index = listaAlumnos.findIndex(a => a.id === parseInt(id));
    if (index === -1) return res.status(404).json({ error: "Alumno no encontrado" });

    const [eliminado] = listaAlumnos.splice(index, 1);
    await writeAlumnos(listaAlumnos);
    res.json({ message: "Alumno eliminado", data: omitPassword(eliminado) });
};