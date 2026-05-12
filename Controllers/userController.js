import User from '../models/User.js'; 
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// En ES Modules __dirname no existe por defecto, debemos recrearlo
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const usersFilePath = path.join(__dirname, '../data/users.json');

const readUsers = async () => {
    const data = await fs.readFile(usersFilePath, 'utf-8');
    return JSON.parse(data);
};

const writeUsers = async (data) => {
    await fs.writeFile(usersFilePath, JSON.stringify(data, null, 2));
};

// Renderiza el formulario de registro
export const getRegisterForm = (req, res) => {
    res.render('userRegister');
};

// Renderiza el formulario de edición
export const getEditForm = async (req, res) => {
    const { id } = req.params;
    const listaUsuario = await readUsers();
    const usuario = listaUsuario.find(u => u.id === parseInt(id));
    if (!usuario) return res.status(404).send("Usuario no encontrado");
    
    res.render('userEdit', { user: usuario });
};

export const getUsers = async (req, res) => {
    const listaUsuario = await readUsers();
    const usuariosSinPassword = listaUsuario.map(({ id, name, email }) => ({ id, name, email }));
    res.render('userList', { users: usuariosSinPassword });
};

export const getUserById = async (req, res) => {
    const { id } = req.params;
    const listaUsuario = await readUsers();
    const usuario = listaUsuario.find(u => u.id === parseInt(id));
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
    const listaUsuario = await readUsers();
    const nuevoUsuario = new User(parseInt(id), name, email, password);
    listaUsuario.push(nuevoUsuario);
    await writeUsers(listaUsuario);
    res.redirect('/getUsers'); // Redirige de vuelta a la lista tras guardar
};

export const updateUser = async (req, res) => {
    const { id } = req.params;
    const { name, email, password } = req.body;
    let listaUsuario = await readUsers();
    const usuario = listaUsuario.find(u => u.id === parseInt(id));
    if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });

    if (name) usuario.name = name;
    if (email) usuario.email = email;
    if (password) usuario.password = password;

    await writeUsers(listaUsuario);
    res.redirect('/getUsers'); // Redirige a la lista tras actualizar
};

export const deleteUser = async (req, res) => {
    const { id } = req.params;
    let listaUsuario = await readUsers();
    const index = listaUsuario.findIndex(u => u.id === parseInt(id));
    if (index === -1) return res.status(404).json({ error: "Usuario no encontrado" });

    listaUsuario.splice(index, 1);
    await writeUsers(listaUsuario);
    res.redirect('/getUsers'); // Redirige a la tabla tras eliminar
};