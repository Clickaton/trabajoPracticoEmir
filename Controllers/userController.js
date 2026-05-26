import User from '../models/User.js'; 
import { getDB } from '../config/db.js';

const getCollection = () => getDB().collection('users');

// Renderiza el formulario de registro
export const getRegisterForm = (req, res) => {
    res.render('userRegister');
};

// Renderiza el formulario de edición
export const getEditForm = async (req, res) => {
    const { id } = req.params;
    const usuario = await getCollection().findOne({ id: parseInt(id) });
    if (!usuario) return res.status(404).send("Usuario no encontrado");
    
    res.render('userEdit', { user: usuario });
};

export const getUsers = async (req, res) => {
    const listaUsuario = await getCollection().find().toArray();
    const usuariosSinPassword = listaUsuario.map(({ id, name, email }) => ({ id, name, email }));
    res.render('userList', { users: usuariosSinPassword });
};

export const getUserById = async (req, res) => {
    const { id } = req.params;
    const usuario = await getCollection().findOne({ id: parseInt(id) });
    if (!usuario) {
        return res.status(404).json({ error: "Usuario no encontrado" });
    }
    const { password, ...usuarioSinPassword } = usuario;
    res.json({ message: `Detalles del usuario con ID: ${id}`, user: usuarioSinPassword });
};

export const createUser = async (req, res) => {
    const { id, name, email, password } = req.body;
    if (!id || !name || !email || !password) {
        return res.status(400).json({ error: "Faltan datos obligatorios" });
    }
    const nuevoUsuario = new User(parseInt(id), name, email, password);
    await getCollection().insertOne(nuevoUsuario);
    res.redirect('/getUsers'); // Redirige de vuelta a la lista tras guardar
};

export const updateUser = async (req, res) => {
    const { id } = req.params;
    const { name, email, password } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (password) updateData.password = password;
    
    await getCollection().updateOne({ id: parseInt(id) }, { $set: updateData });
    res.redirect('/getUsers'); // Redirige a la lista tras actualizar
};

export const deleteUser = async (req, res) => {
    const { id } = req.params;
    await getCollection().deleteOne({ id: parseInt(id) });
    res.redirect('/getUsers'); // Redirige a la tabla tras eliminar
};