const Cohorte = require('../models/Cohorte');
let listaCohorte = [
    {   
        id: 1, 
        name: "Cohorte 1",
        startDate: "2024-01-01", 
        endDate: "2024-06-30",
        day: "Viernes", 
        materia: "Matemáticas (Clase/Objeto)", 
        userList: [
            {id: 1, name: "Juan Pérez", email: "juan.perez@example.com"}, 
            {id: 2, name: "María García", email: "maria.garcia@example.com"},
            {id: 3, name: "Carlos López", email: "carlos.lopez@example.com"}
        ] 
    },
    {   
        id: 2, 
        name: "Cohorte 2", 
        startDate: "2024-02-01", 
        endDate: "2024-07-31",
        day: "Miercoles", 
        materia: "Física (Clase/Objeto)", 
        userList: [
            {id: 1, name: "Juan Pérez", email: "juan.perez@example.com"}, 
            {id: 2, name: "María García", email: "maria.garcia@example.com"},
            {id: 3, name: "Carlos López", email: "carlos.lopez@example.com"}
        ] 
    },
    { 
        id: 3, 
        name: "Cohorte 3", 
        startDate: "2024-03-01", 
        endDate: "2024-08-31",
        day: "Lunes",
        materia: "Química (Clase/Objeto)", 
        userList: [
            {id: 1, name: "Juan Pérez", email: "juan.perez@example.com"}, 
            {id: 2, name: "María García", email: "maria.garcia@example.com"},
            {id: 3, name: "Carlos López", email: "carlos.lopez@example.com"}
        ] 
    }
];

exports.getCohortes = (req, res) => {
    res.json({ message: 'Lista de cohortes', data: listaCohorte });
};

exports.getCohorteById = (req, res) => {
    const { id } = req.params;
    const cohorte = listaCohorte.find(c => c.id === parseInt(id));
    if (!cohorte) return res.status(404).json({ error: "Cohorte no encontrado" });
    
    res.json({ message: 'Detalle del cohorte', data: cohorte });
};

exports.createCohorte = (req, res) => {
    const { id, name, startDate, endDate, materia, userList } = req.body;
    
    if (!id || !name || !startDate || !endDate || !materia) {
        return res.status(400).json({ error: "Faltan datos obligatorios (id, name, startDate, endDate, materia)" });
    }

    const listaAlumnos = Array.isArray(userList) ? userList : [];

    const nuevoCohorte = new Cohorte(id, name, startDate, endDate, materia, userList);
    listaCohorte.push(nuevoCohorte);
    
    res.status(201).json({ message: 'Cohorte creado exitosamente', cohorte: nuevoCohorte });
};

exports.updateCohorte = (req, res) => {
    const { id } = req.params;
    const { name, startDate, endDate, materia, userList } = req.body;
    const cohorte = listaCohorte.find(c => c.id === parseInt(id));
    
    if (!cohorte) return res.status(404).json({ error: "Cohorte no encontrado" });
    
    if (name) cohorte.name = name;
    if (startDate) cohorte.startDate = startDate;
    if (endDate) cohorte.endDate = endDate;
    if (materia) cohorte.materia = materia;
    if (Array.isArray(userList)) cohorte.userList = userList;
    
    res.json({ message: "Cohorte actualizado", cohorte: cohorte });
};

exports.deleteCohorte = (req, res) => {
    const { id } = req.params;
    const index = listaCohorte.findIndex(c => c.id === parseInt(id));
    if (index === -1) return res.status(404).json({ error: "Cohorte no encontrado" });
    
    const eliminado = listaCohorte.splice(index, 1);
    res.json({ message: "Cohorte eliminado", cohorte: eliminado[0] });
};


exports.addUserToCohorte = (req, res) => {
    const { cohorteId } = req.params;
    const { user } = req.body; 
    const cohorte = listaCohorte.find(c => c.id === parseInt(cohorteId));
    if (!cohorte) return res.status(404).json({ error: "Cohorte no encontrado" });

    if (!user || !user.id || !user.name) {
        return res.status(400).json({ error: "Datos de usuario inválidos (se requiere id y name)" });
    }

    const yaExiste = cohorte.userList.some(u => u.id === user.id);
    if (yaExiste) return res.status(400).json({ error: "El usuario ya pertenece a este cohorte" });

    cohorte.userList.push(user);
    res.json({ message: "Usuario agregado al cohorte", cohorte: cohorte });
};

exports.removeUserFromCohorte = (req, res) => {
    const { cohorteId } = req.params;
    const { userId } = req.body; 
    
    const cohorte = listaCohorte.find(c => c.id === parseInt(cohorteId));
    if (!cohorte) return res.status(404).json({ error: "Cohorte no encontrado" });

    const userIndex = cohorte.userList.findIndex(u => u.id === parseInt(userId));
    if (userIndex === -1) {
        return res.status(404).json({ error: "Usuario no encontrado en este cohorte" });
    }
    
    cohorte.userList.splice(userIndex, 1);
    res.json({ message: "Usuario eliminado del cohorte", cohorte: cohorte });
};


exports.getUsersInCohorte = (req, res) => {
    const { cohorteId } = req.params;
    const cohorte = listaCohorte.find(c => c.id === parseInt(cohorteId));
    if (!cohorte) return res.status(404).json({ error: "Cohorte no encontrado" });

    res.json({ message: "Lista de usuarios en el cohorte", users: cohorte.userList });
};

exports.getMateriaOfCohorte = (req, res) => {
    const { cohorteId } = req.params;
    const cohorte = listaCohorte.find(c => c.id === parseInt(cohorteId));
    if (!cohorte) return res.status(404).json({ error: "Cohorte no encontrado" });

    res.json({ message: "Materia del cohorte", materia: cohorte.materia });
};

exports.getCohorteDuration = (req, res) => {
    const { cohorteId } = req.params;
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
    res.json({ message: "Lista de cohortes con usuarios", data: listaCohorte });
};