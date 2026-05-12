import Cohorte from '../models/Cohorte.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cohortesFilePath = path.join(__dirname, '../data/cohortes.json');

const readCohortes = async () => {
    const data = await fs.readFile(cohortesFilePath, 'utf-8');
    return JSON.parse(data);
};

const writeCohortes = async (data) => {
    await fs.writeFile(cohortesFilePath, JSON.stringify(data, null, 2));
};

export const getCohortes = async (req, res) => {
    const listaCohorte = await readCohortes();
    res.json({ message: 'Lista de cohortes', data: listaCohorte });
};

export const getCohorteById = async (req, res) => {
    const { id } = req.params;
    const listaCohorte = await readCohortes();
    const cohorte = listaCohorte.find(c => c.id === parseInt(id));
    if (!cohorte) return res.status(404).json({ error: "Cohorte no encontrado" });
    
    res.json({ message: 'Detalle del cohorte', data: cohorte });
};

export const createCohorte = async (req, res) => {
    const { id, name, startDate, endDate, materia, userList } = req.body;
    
    if (!id || !name || !startDate || !endDate || !materia) {
        return res.status(400).json({ error: "Faltan datos obligatorios (id, name, startDate, endDate, materia)" });
    }

    const listaCohorte = await readCohortes();
    const listaAlumnos = Array.isArray(userList) ? userList : [];

    const nuevoCohorte = new Cohorte(id, name, startDate, endDate, materia, userList);
    listaCohorte.push(nuevoCohorte);
    await writeCohortes(listaCohorte);
    
    res.status(201).json({ message: 'Cohorte creado exitosamente', cohorte: nuevoCohorte });
};

export const updateCohorte = async (req, res) => {
    const { id } = req.params;
    const { name, startDate, endDate, materia, userList } = req.body;
    let listaCohorte = await readCohortes();
    const cohorte = listaCohorte.find(c => c.id === parseInt(id));
    
    if (!cohorte) return res.status(404).json({ error: "Cohorte no encontrado" });
    
    if (name) cohorte.name = name;
    if (startDate) cohorte.startDate = startDate;
    if (endDate) cohorte.endDate = endDate;
    if (materia) cohorte.materia = materia;
    if (Array.isArray(userList)) cohorte.userList = userList;
    
    await writeCohortes(listaCohorte);
    res.json({ message: "Cohorte actualizado", cohorte: cohorte });
};

export const deleteCohorte = async (req, res) => {
    const { id } = req.params;
    let listaCohorte = await readCohortes();
    const index = listaCohorte.findIndex(c => c.id === parseInt(id));
    if (index === -1) return res.status(404).json({ error: "Cohorte no encontrado" });
    
    const eliminado = listaCohorte.splice(index, 1);
    await writeCohortes(listaCohorte);
    res.json({ message: "Cohorte eliminado", cohorte: eliminado[0] });
};


export const addUserToCohorte = async (req, res) => {
    const { cohorteId } = req.params;
    const { user } = req.body; 
    let listaCohorte = await readCohortes();
    const cohorte = listaCohorte.find(c => c.id === parseInt(cohorteId));
    if (!cohorte) return res.status(404).json({ error: "Cohorte no encontrado" });

    if (!user || !user.id || !user.name) {
        return res.status(400).json({ error: "Datos de usuario inválidos (se requiere id y name)" });
    }

    const yaExiste = cohorte.userList.some(u => u.id === user.id);
    if (yaExiste) return res.status(400).json({ error: "El usuario ya pertenece a este cohorte" });

    cohorte.userList.push(user);
    await writeCohortes(listaCohorte);
    res.json({ message: "Usuario agregado al cohorte", cohorte: cohorte });
};

export const removeUserFromCohorte = async (req, res) => {
    const { cohorteId } = req.params;
    const { userId } = req.body; 
    let listaCohorte = await readCohortes();
    
    const cohorte = listaCohorte.find(c => c.id === parseInt(cohorteId));
    if (!cohorte) return res.status(404).json({ error: "Cohorte no encontrado" });

    const userIndex = cohorte.userList.findIndex(u => u.id === parseInt(userId));
    if (userIndex === -1) {
        return res.status(404).json({ error: "Usuario no encontrado en este cohorte" });
    }
    
    cohorte.userList.splice(userIndex, 1);
    await writeCohortes(listaCohorte);
    res.json({ message: "Usuario eliminado del cohorte", cohorte: cohorte });
};


export const getUsersInCohorte = async (req, res) => {
    const { cohorteId } = req.params;
    const listaCohorte = await readCohortes();
    const cohorte = listaCohorte.find(c => c.id === parseInt(cohorteId));
    if (!cohorte) return res.status(404).json({ error: "Cohorte no encontrado" });

    res.json({ message: "Lista de usuarios en el cohorte", users: cohorte.userList });
};

export const getMateriaOfCohorte = async (req, res) => {
    const { cohorteId } = req.params;
    const listaCohorte = await readCohortes();
    const cohorte = listaCohorte.find(c => c.id === parseInt(cohorteId));
    if (!cohorte) return res.status(404).json({ error: "Cohorte no encontrado" });

    res.json({ message: "Materia del cohorte", materia: cohorte.materia });
};

export const getCohorteDuration = async (req, res) => {
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

export const getAllCohortesWithUsers = async (req, res) => {
    const listaCohorte = await readCohortes();
    res.json({ message: "Lista de cohortes con usuarios", data: listaCohorte });
};