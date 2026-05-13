import Cohorte from '../models/Cohorte.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cohortesFilePath = path.join(__dirname, '../data/cohortes.json');
const alumnosFilePath = path.join(__dirname, '../data/alumnos.json');

const readCohortes = async () => {
    const data = await fs.readFile(cohortesFilePath, 'utf-8');
    return JSON.parse(data);
};

const writeCohortes = async (data) => {
    await fs.writeFile(cohortesFilePath, JSON.stringify(data, null, 2));
};

const readAlumnos = async () => {
    const data = await fs.readFile(alumnosFilePath, 'utf-8');
    return JSON.parse(data);
};

// HELPER: Cruza los IDs de userList con los datos reales de alumnos.json
const poblarUserList = (userList, alumnos) => {
    return userList.map(id => {
        const alumno = alumnos.find(a => a.id === id);
        return alumno
            ? { id: alumno.id, name: alumno.name, email: alumno.email }
            : { id, error: "Alumno no encontrado" };
    });
};

// Obtener todas las cohortes
const getCohortes = async (req, res) => {
    const listaCohorte = await readCohortes();
    const alumnos = await readAlumnos();
    const cohortesPobladas = listaCohorte.map(c => ({
        ...c,
        userList: poblarUserList(c.userList, alumnos)
    }));
    res.json({ message: 'Lista de cohortes', data: cohortesPobladas });
};

// Obtener una cohorte por ID
const getCohorteById = async (req, res) => {
    const { id } = req.params;
    const listaCohorte = await readCohortes();
    const alumnos = await readAlumnos();
    const cohorte = listaCohorte.find(c => c.id === parseInt(id));
    if (!cohorte) return res.status(404).json({ error: "Cohorte no encontrado" });

    res.json({ message: 'Detalle del cohorte', data: {
        ...cohorte,
        userList: poblarUserList(cohorte.userList, alumnos)
    }});
};

// Crear una cohorte
const createCohorte = async (req, res) => {
    const { id, name, startDate, endDate } = req.body;

    if (!id || !name || !startDate || !endDate) {
        return res.status(400).json({ error: "Faltan datos obligatorios (id, name, startDate, endDate)" });
    }

    const listaCohorte = await readCohortes();
    const nuevoCohorte = new Cohorte(parseInt(id), name, startDate, endDate, []);
    listaCohorte.push(nuevoCohorte);
    await writeCohortes(listaCohorte);

    res.status(201).json({ message: 'Cohorte creado exitosamente', cohorte: nuevoCohorte });
};

// Actualizar una cohorte
const updateCohorte = async (req, res) => {
    const { id } = req.params;
    const { name, startDate, endDate } = req.body;
    const listaCohorte = await readCohortes();
    const cohorte = listaCohorte.find(c => c.id === parseInt(id));

    if (!cohorte) return res.status(404).json({ error: "Cohorte no encontrado" });

    if (name) cohorte.name = name;
    if (startDate) cohorte.startDate = startDate;
    if (endDate) cohorte.endDate = endDate;

    await writeCohortes(listaCohorte);
    res.json({ message: "Cohorte actualizado", cohorte: cohorte });
};

// Eliminar una cohorte
const deleteCohorte = async (req, res) => {
    const { id } = req.params;
    const listaCohorte = await readCohortes();
    const index = listaCohorte.findIndex(c => c.id === parseInt(id));
    if (index === -1) return res.status(404).json({ error: "Cohorte no encontrado" });

    const [eliminado] = listaCohorte.splice(index, 1);
    await writeCohortes(listaCohorte);
    res.json({ message: "Cohorte eliminado", cohorte: eliminado });
};

// Agregar un alumno a una cohorte
const addUserToCohorte = async (req, res) => {
    const { cohorteId } = req.params;
    const { alumnoId } = req.body;

    const listaCohorte = await readCohortes();
    const alumnos = await readAlumnos();

    const cohorte = listaCohorte.find(c => c.id === parseInt(cohorteId));
    if (!cohorte) return res.status(404).json({ error: "Cohorte no encontrado" });

    const alumno = alumnos.find(a => a.id === parseInt(alumnoId));
    if (!alumno) return res.status(404).json({ error: "Alumno no encontrado" });

    const yaExiste = cohorte.userList.includes(parseInt(alumnoId));
    if (yaExiste) return res.status(400).json({ error: "El alumno ya pertenece a este cohorte" });

    cohorte.userList.push(parseInt(alumnoId));
    await writeCohortes(listaCohorte);
    res.json({ message: "Alumno agregado al cohorte", cohorte: {
        ...cohorte,
        userList: poblarUserList(cohorte.userList, alumnos)
    }});
};

// Eliminar un alumno de una cohorte
const removeUserFromCohorte = async (req, res) => {
    const { cohorteId } = req.params;
    const { alumnoId } = req.body;

    const listaCohorte = await readCohortes();
    const alumnos = await readAlumnos();

    const cohorte = listaCohorte.find(c => c.id === parseInt(cohorteId));
    if (!cohorte) return res.status(404).json({ error: "Cohorte no encontrado" });

    const index = cohorte.userList.indexOf(parseInt(alumnoId));
    if (index === -1) return res.status(404).json({ error: "Alumno no encontrado en este cohorte" });

    cohorte.userList.splice(index, 1);
    await writeCohortes(listaCohorte);
    res.json({ message: "Alumno eliminado del cohorte", cohorte: {
        ...cohorte,
        userList: poblarUserList(cohorte.userList, alumnos)
    }});
};

// Obtener los alumnos de una cohorte
const getUsersInCohorte = async (req, res) => {
    const { cohorteId } = req.params;
    const listaCohorte = await readCohortes();
    const alumnos = await readAlumnos();

    const cohorte = listaCohorte.find(c => c.id === parseInt(cohorteId));
    if (!cohorte) return res.status(404).json({ error: "Cohorte no encontrado" });

    res.json({ message: "Lista de alumnos en el cohorte", users: poblarUserList(cohorte.userList, alumnos) });
};

// Obtener duración de una cohorte en días
const getCohorteDuration = async (req, res) => {
    const { cohorteId } = req.params;
    const listaCohorte = await readCohortes();
    const cohorte = listaCohorte.find(c => c.id === parseInt(cohorteId));
    if (!cohorte) return res.status(404).json({ error: "Cohorte no encontrado" });

    const start = new Date(cohorte.startDate);
    const end = new Date(cohorte.endDate);

    if (isNaN(start) || isNaN(end)) {
        return res.status(500).json({ error: "Formato de fecha inválido en el servidor" });
    }

    const duration = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    res.json({ message: "Duración del cohorte en días", duration: duration });
};

export default {
    getCohortes,
    getCohorteById,
    createCohorte,
    updateCohorte,
    deleteCohorte,
    addUserToCohorte,
    removeUserFromCohorte,
    getUsersInCohorte,
    getCohorteDuration
};