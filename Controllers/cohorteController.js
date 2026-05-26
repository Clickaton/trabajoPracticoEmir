import Cohorte from '../models/Cohorte.js';
import { getDB } from '../config/db.js';

const getCollection = () => getDB().collection('cohortes');

export const getCohortes = async (req, res) => {
    const listaCohorte = await getCollection().find().toArray();
    res.json({ message: 'Lista de cohortes', data: listaCohorte });
};

export const getCohorteById = async (req, res) => {
    const { id } = req.params;
    const cohorte = await getCollection().findOne({ id: parseInt(id) });
    if (!cohorte) return res.status(404).json({ error: "Cohorte no encontrado" });
    
    res.json({ message: 'Detalle del cohorte', data: cohorte });
};

export const createCohorte = async (req, res) => {
    const { id, name, startDate, endDate, materia, userList } = req.body;
    
    if (!id || !name || !startDate || !endDate || !materia) {
        return res.status(400).json({ error: "Faltan datos obligatorios (id, name, startDate, endDate, materia)" });
    }

    const listaAlumnos = Array.isArray(userList) ? userList : [];

    const nuevoCohorte = new Cohorte(id, name, startDate, endDate, materia, userList);
    await getCollection().insertOne(nuevoCohorte);
    
    res.status(201).json({ message: 'Cohorte creado exitosamente', cohorte: nuevoCohorte });
};

export const updateCohorte = async (req, res) => {
    const { id } = req.params;
    const { name, startDate, endDate, materia, userList } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (startDate) updateData.startDate = startDate;
    if (endDate) updateData.endDate = endDate;
    if (materia) updateData.materia = materia;
    if (Array.isArray(userList)) updateData.userList = userList;
    
    const result = await getCollection().updateOne({ id: parseInt(id) }, { $set: updateData });
    if (result.matchedCount === 0) return res.status(404).json({ error: "Cohorte no encontrado" });
    
    const cohorteActualizado = await getCollection().findOne({ id: parseInt(id) });
    res.json({ message: "Cohorte actualizado", cohorte: cohorteActualizado });
};

export const deleteCohorte = async (req, res) => {
    const { id } = req.params;
    const eliminado = await getCollection().findOne({ id: parseInt(id) });
    if (!eliminado) return res.status(404).json({ error: "Cohorte no encontrado" });
    
    await getCollection().deleteOne({ id: parseInt(id) });
    res.json({ message: "Cohorte eliminado", cohorte: eliminado });
};


export const addUserToCohorte = async (req, res) => {
    const { cohorteId } = req.params;
    const { user } = req.body; 
    const cohorte = await getCollection().findOne({ id: parseInt(cohorteId) });
    if (!cohorte) return res.status(404).json({ error: "Cohorte no encontrado" });

    if (!user || !user.id || !user.name) {
        return res.status(400).json({ error: "Datos de usuario inválidos (se requiere id y name)" });
    }

    const yaExiste = cohorte.userList.some(u => u.id === user.id);
    if (yaExiste) return res.status(400).json({ error: "El usuario ya pertenece a este cohorte" });

    await getCollection().updateOne(
        { id: parseInt(cohorteId) },
        { $push: { userList: user } }
    );
    const cohorteActualizado = await getCollection().findOne({ id: parseInt(cohorteId) });
    res.json({ message: "Usuario agregado al cohorte", cohorte: cohorteActualizado });
};

export const removeUserFromCohorte = async (req, res) => {
    const { cohorteId } = req.params;
    const { userId } = req.body; 
    
    const cohorte = await getCollection().findOne({ id: parseInt(cohorteId) });
    if (!cohorte) return res.status(404).json({ error: "Cohorte no encontrado" });

    const userIndex = cohorte.userList.findIndex(u => u.id === parseInt(userId));
    if (userIndex === -1) {
        return res.status(404).json({ error: "Usuario no encontrado en este cohorte" });
    }
    
    await getCollection().updateOne(
        { id: parseInt(cohorteId) },
        { $pull: { userList: { id: parseInt(userId) } } }
    );
    const cohorteActualizado = await getCollection().findOne({ id: parseInt(cohorteId) });
    res.json({ message: "Usuario eliminado del cohorte", cohorte: cohorteActualizado });
};


export const getUsersInCohorte = async (req, res) => {
    const { cohorteId } = req.params;
    const cohorte = await getCollection().findOne({ id: parseInt(cohorteId) });
    if (!cohorte) return res.status(404).json({ error: "Cohorte no encontrado" });

    res.json({ message: "Lista de usuarios en el cohorte", users: cohorte.userList });
};

export const getMateriaOfCohorte = async (req, res) => {
    const { cohorteId } = req.params;
    const cohorte = await getCollection().findOne({ id: parseInt(cohorteId) });
    if (!cohorte) return res.status(404).json({ error: "Cohorte no encontrado" });

    res.json({ message: "Materia del cohorte", materia: cohorte.materia });
};

export const getCohorteDuration = async (req, res) => {
    const { cohorteId } = req.params;
    const cohorte = await getCollection().findOne({ id: parseInt(cohorteId) });
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
    const listaCohorte = await getCollection().find().toArray();
    res.json({ message: "Lista de cohortes con usuarios", data: listaCohorte });
};