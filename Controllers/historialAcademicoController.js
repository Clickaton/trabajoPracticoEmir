import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import HistorialAcademico from '../models/HistorialAcademico.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const historialFilePath = path.join(__dirname, '../data/historialAcademico.json');
const alumnosFilePath   = path.join(__dirname, '../data/alumnos.json');
const materiasFilePath  = path.join(__dirname, '../data/materias.json');

const readHistorial = async () => {
    const data = await fs.readFile(historialFilePath, 'utf-8');
    return JSON.parse(data);
};

const writeHistorial = async (data) => {
    await fs.writeFile(historialFilePath, JSON.stringify(data, null, 2));
};

const readAlumnos = async () => {
    const data = await fs.readFile(alumnosFilePath, 'utf-8');
    return JSON.parse(data);
};

const readMaterias = async () => {
    const data = await fs.readFile(materiasFilePath, 'utf-8');
    return JSON.parse(data);
};

// HELPER: Cruza los IDs con los nombres reales
const poblarHistorial = (registro, alumnos, materias) => {
    const alumno  = alumnos.find(a => a.id === registro.alumno_id);
    const materia = materias.find(m => m.id === registro.materia_id);

    return {
        id_registro: registro.id,
        alumno:  alumno  ? alumno.name    : "Alumno Desconocido",
        materia: materia ? materia.nombre : "Materia Desconocida",
        anio:    materia ? materia.anio   : null,
        estado:  registro.estado,
        nota:    registro.nota
    };
};

// Obtener TODO el historial agrupado por alumno (Para el Admin)
const getHistorial = async (req, res) => {
    const lista    = await readHistorial();
    const alumnos  = await readAlumnos();
    const materias = await readMaterias();

    const historialAgrupado = alumnos.map(alumno => {
        const registrosAlumno = lista
            .filter(r => r.alumno_id === alumno.id)
            .map(r => {
                const materia = materias.find(m => m.id === r.materia_id);
                return {
                    materia: materia ? materia.nombre : "Materia Desconocida",
                    anio:    materia ? materia.anio   : null,
                    estado:  r.estado,
                    nota:    r.nota
                };
            })
            .sort((a, b) => a.anio - b.anio);

        return {
            alumno: alumno.name,
            registros: registrosAlumno
        };
    });

    res.json({ message: 'Historial Académico Global', data: historialAgrupado });
};

// Obtener el historial de un SOLO alumno
const getHistorialByAlumno = async (req, res) => {
    const { alumnoId } = req.params;
    const lista    = await readHistorial();
    const alumnos  = await readAlumnos();
    const materias = await readMaterias();
    const historialAlumno = lista.filter(h => h.alumno_id === parseInt(alumnoId));

    if (historialAlumno.length === 0) {
        return res.status(404).json({ error: `No se encontró historial para el alumno ID: ${alumnoId}` });
    }

    const historialCompleto = historialAlumno.map(r => poblarHistorial(r, alumnos, materias));
    res.json({ message: `Historial del alumno ID: ${alumnoId}`, data: historialCompleto });
};

// Crear un nuevo registro
const createRegistro = async (req, res) => {
    const { id, alumno_id, materia_id, estado, nota = null } = req.body;

    if (!id || !alumno_id || !materia_id || !estado) {
        return res.status(400).json({ error: "Faltan datos obligatorios" });
    }

    const estadosValidos = ['Cursando', 'Regular', 'Aprobada'];
    if (!estadosValidos.includes(estado)) {
        return res.status(400).json({ error: "El estado solo puede ser 'Cursando', 'Regular' o 'Aprobada'" });
    }

    const lista = await readHistorial();
    const nuevoRegistro = new HistorialAcademico(id, alumno_id, materia_id, estado, nota);
    lista.push(nuevoRegistro);
    await writeHistorial(lista);

    res.status(201).json({ message: 'Registro creado exitosamente', data: nuevoRegistro });
};

// Actualizar un registro (estado y/o nota)
const updateRegistro = async (req, res) => {
    const { id } = req.params;
    const { estado, nota } = req.body;

    const lista = await readHistorial();
    const registro = lista.find(h => h.id === parseInt(id));
    if (!registro) return res.status(404).json({ error: "Registro no encontrado" });

    if (estado) {
        const estadosValidos = ['Cursando', 'Regular', 'Aprobada'];
        if (!estadosValidos.includes(estado)) {
            return res.status(400).json({ error: "El estado solo puede ser 'Cursando', 'Regular' o 'Aprobada'" });
        }
        registro.estado = estado;
    }

    if (nota !== undefined) registro.nota = nota;

    await writeHistorial(lista);
    res.json({ message: "Registro actualizado", data: registro });
};

export default { 
    getHistorial,
    getHistorialByAlumno,
    createRegistro,
    updateRegistro
};