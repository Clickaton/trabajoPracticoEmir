const Alumno = require('../models/Alumno.js');
const fs = require('fs');
const path = require('path');

const alumnosFilePath = path.join(__dirname, '../data/alumnos.json');

const readAlumnos = () => {
    const data = fs.readFileSync(alumnosFilePath, 'utf-8');
    return JSON.parse(data);
};

const writeAlumnos = (data) => {
    fs.writeFileSync(alumnosFilePath, JSON.stringify(data, null, 2));
};

// Función helper para omitir la contraseña en las respuestas y no repetir código.
const omitPassword = (alumno) => {
    const { password, ...alumnoSinPassword } = alumno;
    return alumnoSinPassword;
};

exports.getAlumnos = (req, res) => {
    const listaAlumnos = readAlumnos();
    const alumnosSinPassword = listaAlumnos.map(omitPassword);
    res.json({ message: 'Lista de alumnos', data: alumnosSinPassword });
};

exports.getAlumnoById = (req, res) => {
    const { id } = req.params;
    const listaAlumnos = readAlumnos();
    const alumno = listaAlumnos.find(a => a.id === parseInt(id));
    if (!alumno) {
        return res.status(404).json({ error: "Alumno no encontrado" });
    }
    res.json({ message:` Detalles del alumno con ID: ${id}`, data: omitPassword(alumno) });
};

exports.createAlumno = (req, res) => {
    const { id, name, email, password, legajo, activo, fecha_inscripcion } = req.body;

    if (!id || !name || !email || !password || !legajo || activo === undefined || !fecha_inscripcion) {
        return res.status(400).json({ error: "Faltan datos obligatorios (id, name, email, password, legajo, activo, fecha_inscripcion)" });
    }

    const listaAlumnos = readAlumnos();
    // Hashear la contraseña antes de guardarla.
    const nuevoAlumno = new Alumno(id, name, email, password, legajo, activo, new Date(fecha_inscripcion));
    listaAlumnos.push(nuevoAlumno);
    writeAlumnos(listaAlumnos);

    res.status(201).json({ message: 'Alumno creado exitosamente', data: omitPassword(nuevoAlumno) });
};

exports.updateAlumno = (req, res) => {
    const { id } = req.params;
    const { name, email, password, legajo, activo, fecha_inscripcion } = req.body;

    let listaAlumnos = readAlumnos();
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

    writeAlumnos(listaAlumnos);

    res.json({ message: "Alumno actualizado", data: omitPassword(alumno) });
};

exports.deleteAlumno = (req, res) => {
    const { id } = req.params;
    let listaAlumnos = readAlumnos();
    const index = listaAlumnos.findIndex(a => a.id === parseInt(id));
    if (index === -1) return res.status(404).json({ error: "Alumno no encontrado" });

    const [eliminado] = listaAlumnos.splice(index, 1);
    writeAlumnos(listaAlumnos);
    res.json({ message: "Alumno eliminado", data: omitPassword(eliminado) });
};