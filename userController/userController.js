const User = require('../models/User'); 

let listaUsuario = [
    { id: 1, name: "Juan Pérez", email: "juan.perez@example.com" },
    { id: 2, name: "María García", email: "maria.garcia@example.com" },
    { id: 3, name: "Carlos López", email: "carlos.lopez@example.com" }
];

exports.getUsers = (req, res) => {
    res.json({ message: 'Lista de usuarios', data: listaUsuario });
};

exports.getUserById = (req, res) => {
    const { id } = req.params;
    const usuario = listaUsuario.find(u => u.id === parseInt(id));
    if (!usuario) {
        return res.status(404).json({ error: "Usuario no encontrado" });
    }
    res.json({ message: `Detalles del usuario con ID: ${id}`, user: usuario });
};

exports.createUser = (req, res) => {
    const { id, name, email } = req.body;
    if (!id || !name || !email) {
        return res.status(400).json({ error: "Faltan datos obligatorios" });
    }
    const nuevoUsuario = new User(id, name, email);
    listaUsuario.push(nuevoUsuario);
    res.json({ message: 'Usuario creado exitosamente', user: nuevoUsuario });
};

exports.updateUser = (req, res) => {
    const { id } = req.params;
    const { name, email } = req.body;
    const usuario = listaUsuario.find(u => u.id === parseInt(id));
    if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });

    if (name) usuario.name = name;
    if (email) usuario.email = email;

    res.json({ message: "Usuario actualizado", user: usuario });
};

exports.deleteUser = (req, res) => {
    const { id } = req.params;
    const index = listaUsuario.findIndex(u => u.id === parseInt(id));
    if (index === -1) return res.status(404).json({ error: "Usuario no encontrado" });

    const eliminado = listaUsuario.splice(index, 1);
    res.json({ message: "Usuario eliminado", user: eliminado });
};