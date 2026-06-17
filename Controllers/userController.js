import User from '../models/User.js'; // Asegurate de que la ruta sea correcta (mayúsculas/minúsculas)

// Renderiza el formulario de registro
export const getRegisterForm = (req, res) => {
    res.render('userRegister');
};

// Renderiza el formulario de edición
export const getEditForm = async (req, res) => {
    try {
        const { id } = req.params;
        // Buscamos en MongoDB por nuestro campo 'id' numérico
        const usuario = await User.findOne({ id: parseInt(id) }); 
        
        if (!usuario) return res.status(404).send("Usuario no encontrado");
        
        res.render('userEdit', { user: usuario });
    } catch (error) {
        res.status(500).send("Error interno del servidor");
    }
};

export const getUsers = async (req, res) => {
    try {
        // Buscamos todos los usuarios. El .select() excluye contraseñas y el _id propio de Mongo para replicar tu lógica exacta
        const usuariosSinPassword = await User.find().select('id name email -_id');
        res.render('userList', { users: usuariosSinPassword });
    } catch (error) {
        res.status(500).send("Error interno del servidor");
    }
};

export const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const usuario = await User.findOne({ id: parseInt(id) }).select('-_id -__v');
        
        if (!usuario) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }
        
        // Convertimos el documento de mongoose a un objeto JS puro para quitar la contraseña
        const userObj = usuario.toObject();
        const { password, ...usuarioSinPassword } = userObj;
        
        res.json({ message: `Detalles del usuario con ID: ${id}`, user: usuarioSinPassword });
    } catch (error) {
        res.status(500).json({ error: "Error interno del servidor" });
    }
};

export const createUser = async (req, res) => {
    try {
        const { id, name, email, password } = req.body;
        if (!id || !name || !email || !password) {
            return res.status(400).json({ error: "Faltan datos obligatorios" });
        }
        
        // Mongoose se encarga de instanciar y guardar en Atlas
        await User.create({
            id: parseInt(id),
            name,
            email,
            password
        });
        
        res.redirect('/getUsers'); 
    } catch (error) {
        // Si el id está duplicado, Mongo tira error 11000
        if (error.code === 11000) {
            return res.status(400).json({ error: "El ID de usuario ya existe" });
        }
        res.status(500).json({ error: "Error interno del servidor" });
    }
};

export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, password } = req.body;
        
        // Armamos un objeto solo con los datos que nos llegan
        const datosAActualizar = {};
        if (name) datosAActualizar.name = name;
        if (email) datosAActualizar.email = email;
        if (password) datosAActualizar.password = password;

        const usuarioActualizado = await User.findOneAndUpdate(
            { id: parseInt(id) }, 
            datosAActualizar, 
            { new: true } // Devuelve el documento actualizado
        );

        if (!usuarioActualizado) return res.status(404).json({ error: "Usuario no encontrado" });

        res.redirect('/getUsers');
    } catch (error) {
        res.status(500).json({ error: "Error interno del servidor" });
    }
};

export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        const usuarioEliminado = await User.findOneAndDelete({ id: parseInt(id) });

        if (!usuarioEliminado) return res.status(404).json({ error: "Usuario no encontrado" });

        res.redirect('/getUsers');
    } catch (error) {
        res.status(500).json({ error: "Error interno del servidor" });
    }
};