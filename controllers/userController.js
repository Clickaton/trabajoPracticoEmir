const User = require('../models/User'); 
const fs = require('fs');
const path = require('path');

const usersFilePath = path.join(__dirname, '../data/users.json');

const readUsers = () => {
    const data = fs.readFileSync(usersFilePath, 'utf-8');
    return JSON.parse(data);
};

const writeUsers = (data) => {
    fs.writeFileSync(usersFilePath, JSON.stringify(data, null, 2));
};

// Renderiza el formulario de registro
exports.getRegisterForm = (req, res) => {
    res.render('userRegister');
};

// Renderiza el formulario de edición
exports.getEditForm = (req, res) => {
    const { id } = req.params;
    const listaUsuario = readUsers();
    const usuario = listaUsuario.find(u => u.id === parseInt(id));
    if (!usuario) return res.status(404).send("Usuario no encontrado");
    
    res.render('userEdit', { user: usuario });
};

exports.getUsers = (req, res) => {
    const listaUsuario = readUsers();
    const usuariosSinPassword = listaUsuario.map(({ id, name, email }) => ({ id, name, email }));
    res.render('userList', { users: usuariosSinPassword });
};

exports.getUserById = (req, res) => {
    const { id } = req.params;
    const listaUsuario = readUsers();
    const usuario = listaUsuario.find(u => u.id === parseInt(id));
    if (!usuario) {
        return res.status(404).json({ error: "Usuario no encontrado" });
    }
    const { password, ...usuarioSinPassword } = usuario;
    res.json({ message: `Detalles del usuario con ID: ${id}`, user: usuarioSinPassword });
};

exports.createUser = (req, res) => {
    const { id, name, email, password } = req.body;
    if (!id || !name || !email || !password) {
        return res.status(400).json({ error: "Faltan datos obligatorios" });
    }
    const listaUsuario = readUsers();
    const nuevoUsuario = new User(parseInt(id), name, email, password);
    listaUsuario.push(nuevoUsuario);
    writeUsers(listaUsuario);
    res.redirect('/getUsers'); // Redirige de vuelta a la lista tras guardar
};

exports.updateUser = (req, res) => {
    const { id } = req.params;
    const { name, email, password } = req.body;
    let listaUsuario = readUsers();
    const usuario = listaUsuario.find(u => u.id === parseInt(id));
    if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });

    if (name) usuario.name = name;
    if (email) usuario.email = email;
    if (password) usuario.password = password;

    writeUsers(listaUsuario);
    res.redirect('/getUsers'); // Redirige a la lista tras actualizar
};

exports.deleteUser = (req, res) => {
    const { id } = req.params;
    let listaUsuario = readUsers();
    const index = listaUsuario.findIndex(u => u.id === parseInt(id));
    if (index === -1) return res.status(404).json({ error: "Usuario no encontrado" });

    listaUsuario.splice(index, 1);
    writeUsers(listaUsuario);
    res.redirect('/getUsers'); // Redirige a la tabla tras eliminar
};