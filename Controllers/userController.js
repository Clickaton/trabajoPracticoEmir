import User from '../models/User.js'; 
import { getDB } from '../config/db.js';

const getCollection = () => getDB().collection('users');

// Renderiza el formulario de login
export const getLoginForm = (req, res) => {
    // Le pasamos null al error inicial para que no muestre alertas la primera vez
    res.render('userLogin', { error: null });
};

// Procesa los datos del login
export const loginUser = async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.render('userLogin', { error: "Por favor, complete todos los campos" });
    }

    // Buscamos al usuario en la base de datos por email y contraseña
    const usuario = await getCollection().findOne({ email, password });
    if (!usuario) {
        return res.render('userLogin', { error: "Credenciales inválidas. Verifique su email o contraseña." });
    }

    // Si la validación es correcta, lo redirigimos a la tabla de usuarios
    res.redirect('/getUsers'); 
};

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
    // El 'id' ya no viene del formulario, lo generamos automáticamente.
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: "Faltan datos obligatorios" });
    }

    // 1. Buscar el último usuario para obtener el ID más alto.
    const lastUser = await getCollection().find().sort({ id: -1 }).limit(1).toArray();
    
    // 2. Calcular el nuevo ID. Si no hay usuarios, empieza en 1.
    const newId = lastUser.length > 0 ? lastUser[0].id + 1 : 1;

    // 3. Crear la instancia del nuevo usuario con el ID generado.
    const nuevoUsuario = new User(newId, name, email, password);
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