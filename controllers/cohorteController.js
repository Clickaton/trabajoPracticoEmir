const Cohorte = require('../models/Cohorte');
const fs = require('fs');
const path = require('path');

const cohortesFilePath = path.join(__dirname, '../data/cohortes.json');

const readCohortes = () => {
    const data = fs.readFileSync(cohortesFilePath, 'utf-8');
    return JSON.parse(data);
};

const writeCohortes = (data) => {
    fs.writeFileSync(cohortesFilePath, JSON.stringify(data, null, 2));
};

exports.getCohortes = (req, res) => {
    const listaCohorte = readCohortes();
    res.json({ message: 'Lista de cohortes', data: listaCohorte });
};

exports.getCohorteById = (req, res) => {
    const { id } = req.params;
    const listaCohorte = readCohortes();
    const cohorte = listaCohorte.find(c => c.id === parseInt(id));
    if (!cohorte) return res.status(404).json({ error: "Cohorte no encontrado" });
    
    res.json({ message: 'Detalle del cohorte', data: cohorte });
};

exports.createCohorte = (req, res) => {
    const { id, name, startDate, endDate, materia, userList } = req.body;
    
    if (!id || !name || !startDate || !endDate || !materia) {
        return res.status(400).json({ error: "Faltan datos obligatorios (id, name, startDate, endDate, materia)" });
    }

    const listaCohorte = readCohortes();
    const listaAlumnos = Array.isArray(userList) ? userList : [];

    const nuevoCohorte = new Cohorte(id, name, startDate, endDate, materia, userList);
    listaCohorte.push(nuevoCohorte);
    writeCohortes(listaCohorte);
    
    res.status(201).json({ message: 'Cohorte creado exitosamente', cohorte: nuevoCohorte });
};

exports.updateCohorte = (req, res) => {
    const { id } = req.params;
    const { name, startDate, endDate, materia, userList } = req.body;
    let listaCohorte = readCohortes();
    const cohorte = listaCohorte.find(c => c.id === parseInt(id));
    
    if (!cohorte) return res.status(404).json({ error: "Cohorte no encontrado" });
    
    if (name) cohorte.name = name;
    if (startDate) cohorte.startDate = startDate;
    if (endDate) cohorte.endDate = endDate;
    if (materia) cohorte.materia = materia;
    if (Array.isArray(userList)) cohorte.userList = userList;
    
    writeCohortes(listaCohorte);
    res.json({ message: "Cohorte actualizado", cohorte: cohorte });
};

exports.deleteCohorte = (req, res) => {
    const { id } = req.params;
    let listaCohorte = readCohortes();
    const index = listaCohorte.findIndex(c => c.id === parseInt(id));
    if (index === -1) return res.status(404).json({ error: "Cohorte no encontrado" });
    
    const eliminado = listaCohorte.splice(index, 1);
    writeCohortes(listaCohorte);
    res.json({ message: "Cohorte eliminado", cohorte: eliminado[0] });
};


exports.addUserToCohorte = (req, res) => {
    const { cohorteId } = req.params;
    const { user } = req.body; 
    let listaCohorte = readCohortes();
    const cohorte = listaCohorte.find(c => c.id === parseInt(cohorteId));
    if (!cohorte) return res.status(404).json({ error: "Cohorte no encontrado" });

    if (!user || !user.id || !user.name) {
        return res.status(400).json({ error: "Datos de usuario inválidos (se requiere id y name)" });
    }

    const yaExiste = cohorte.userList.some(u => u.id === user.id);
    if (yaExiste) return res.status(400).json({ error: "El usuario ya pertenece a este cohorte" });

    cohorte.userList.push(user);
    writeCohortes(listaCohorte);
    res.json({ message: "Usuario agregado al cohorte", cohorte: cohorte });
};

exports.removeUserFromCohorte = (req, res) => {
    const { cohorteId } = req.params;
    const { userId } = req.body; 
    let listaCohorte = readCohortes();
    
    const cohorte = listaCohorte.find(c => c.id === parseInt(cohorteId));
    if (!cohorte) return res.status(404).json({ error: "Cohorte no encontrado" });

    const userIndex = cohorte.userList.findIndex(u => u.id === parseInt(userId));
    if (userIndex === -1) {
        return res.status(404).json({ error: "Usuario no encontrado en este cohorte" });
    }
    
    cohorte.userList.splice(userIndex, 1);
    writeCohortes(listaCohorte);
    res.json({ message: "Usuario eliminado del cohorte", cohorte: cohorte });
};


exports.getUsersInCohorte = (req, res) => {
    const { cohorteId } = req.params;
    const listaCohorte = readCohortes();
    const cohorte = listaCohorte.find(c => c.id === parseInt(cohorteId));
    if (!cohorte) return res.status(404).json({ error: "Cohorte no encontrado" });

    res.json({ message: "Lista de usuarios en el cohorte", users: cohorte.userList });
};

exports.getMateriaOfCohorte = (req, res) => {
    const { cohorteId } = req.params;
    const listaCohorte = readCohortes();
    const cohorte = listaCohorte.find(c => c.id === parseInt(cohorteId));
    if (!cohorte) return res.status(404).json({ error: "Cohorte no encontrado" });

    res.json({ message: "Materia del cohorte", materia: cohorte.materia });
};

exports.getCohorteDuration = (req, res) => {
    const { cohorteId } = req.params;
    const listaCohorte = readCohortes();
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

exports.getAllCohortesWithUsers = (req, res) => {
    const listaCohorte = readCohortes();
    res.json({ message: "Lista de cohortes con usuarios", data: listaCohorte });
};