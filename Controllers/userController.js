const User = require('../models/User'); 

let listaUsuario = [
    { id: 1, name: "Juan Pérez", email: "juan.perez@example.com", password: "password123"},
    { id: 2, name: "María García", email: "maria.garcia@example.com", password: "password456"},
    { id: 3, name: "Carlos López", email: "carlos.lopez@example.com", password: "password789"}
];

// Renderiza el formulario de registro
exports.getRegisterForm = (req, res) => {
    res.render('userRegister');
};

// Renderiza el formulario de edición
exports.getEditForm = (req, res) => {
    const { id } = req.params;
    const usuario = listaUsuario.find(u => u.id === parseInt(id));
    if (!usuario) return res.status(404).send("Usuario no encontrado");
    
    res.render('userEdit', { user: usuario });
};

exports.getUsers = (req, res) => {
    const usuariosSinPassword = listaUsuario.map(({ id, name, email }) => ({ id, name, email }));
    res.render('userList', { users: usuariosSinPassword });
};

exports.getUserById = (req, res) => {
    const { id } = req.params;
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
    const nuevoUsuario = new User(id, name, email, password);
    listaUsuario.push(nuevoUsuario);
    res.redirect('/getUsers'); // Redirige de vuelta a la lista tras guardar
};

exports.updateUser = (req, res) => {
    const { id } = req.params;
    const { name, email, password } = req.body;
    const usuario = listaUsuario.find(u => u.id === parseInt(id));
    if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });

    if (name) usuario.name = name;
    if (email) usuario.email = email;
    if (password) usuario.password = password;


    res.redirect('/getUsers'); // Redirige a la lista tras actualizar
};

exports.deleteUser = (req, res) => {
    const { id } = req.params;
    const index = listaUsuario.findIndex(u => u.id === parseInt(id));
    if (index === -1) return res.status(404).json({ error: "Usuario no encontrado" });

    const eliminado = listaUsuario.splice(index, 1);
    res.redirect('/getUsers'); // Redirige a la tabla tras eliminar
};