import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import { contraseniaNueva, normalizarEmail, emailValido, emailEnUso } from '../services/usuarioService.js';
import { rutaInicio, renderSinAcceso } from '../middlewares/authHybrid.js';

// Logeo del usuario

export const userLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const usuario = await User.findOne({ email });
        
        if (!usuario) {
            return res.status(401).render('userLogin', { error: 'Credenciales inválidas' });
        }

        const passwordValida = await usuario.comparePassword(password);
        if (!passwordValida) {
            return res.status(401).render('userLogin', { error: 'Credenciales inválidas' });
        }



        if (usuario.rol === undefined)  {
            usuario.rol = usuario.tipoPerfil;    
        }
        if (usuario.role === undefined) {
            usuario.role = usuario.rol || usuario.role || usuario.tipoPerfil || 'Desconocido';
        }

        // Crear payload con datos del usuario
        const payload = {
            id: usuario.id,
            name: usuario.name,
            email: usuario.email,
            rol: usuario.rol,
            role: usuario.role,
            tipoPerfil: usuario.tipoPerfil,
            area: usuario.area,
            legajo: usuario.legajo,
            activo: usuario.activo,
            fecha_inscripcion: usuario.fecha_inscripcion
        };

        // Firmar token JWT con expiración de 8 horas
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

        // Guardar token en cookie httpOnly
        res.cookie('jwtToken', token, {
            httpOnly: true,
            secure: false,      // true en producción (HTTPS)
            maxAge: 1000 * 60 * 60 * 2,
            sameSite: 'lax' // antes: 'strict'
        });
        
        // Cada perfil entra por su pantalla; si su rol no tiene ninguna (Profesor, Bibliotecario) se le explica
        const destino = rutaInicio(usuario);
        if (!destino) return renderSinAcceso(res, usuario);
        return res.redirect(destino);

    } catch (error) {
        res.status(500).send("Error interno del servidor");
    }
};
    

// Renderiza el formulario de edición
export const getEditForm = async (req, res) => {
    try {
        const { id } = req.params;
        // Buscamos en MongoDB por nuestro campo 'id' numérico. Solo se traen los datos que muestra el formulario:
        // la contraseña (su hash) nunca debe llegar a la pantalla.
        const usuario = await User.findOne({ id: parseInt(id) }).select('id name email').lean();

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

//todo verificar esto.
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

//todo Verificar esto
export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
        const email = normalizarEmail(req.body.email);
        const password = contraseniaNueva(req.body.password);

        // Armamos un objeto solo con los datos que nos llegan. Una contraseña vacía conserva la actual.
        const datosAActualizar = {};
        if (name) datosAActualizar.name = name;
        if (email) {
            if (!emailValido(email)) return res.status(400).json({ error: "El email no tiene un formato válido" });
            if (await emailEnUso(email, parseInt(id))) return res.status(409).json({ error: "Ese email ya lo usa otra cuenta" });
            datosAActualizar.email = email;
        }
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

//todo Verificar esto
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

export const logout = (req, res) => {
    // Limpiar cookies
    res.clearCookie('jwtToken');
    res.redirect('/login');
};