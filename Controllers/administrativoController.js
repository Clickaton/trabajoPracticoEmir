import Administrativo from '../models/Administrativo.js';

// Helper: quita la contraseña de los objetos traídos de Mongo
const omitPassword = (admin) => {
    // Convertimos el documento de Mongo a un objeto de JS puro
    const adminObj = admin.toObject(); 
    const { password, ...adminSinPassword } = adminObj;
    return adminSinPassword;
};

// RENDERIZAR VISTAS
const getAdministrativos = async (req, res) => {
    try {
        const administrativosBBDD = await Administrativo.find();
        
        // validación de seguridad (omitPassword).
        // Lo mande abajo la clave "lista" porque así lo configura en el index.pug
        res.render('administrativos/index', { lista: administrativosBBDD.map(omitPassword) });
    } catch (error) {
        res.status(500).send("Error obteniendo administrativos");
    }
};

// PROCESAR DATOS (POST / API)
const getAdministrativoById = async (req, res) => {
    try {
        const admin = await Administrativo.findOne({ id: parseInt(req.params.id) });
        if (!admin) return res.status(404).json({ error: "Administrativo no encontrado" });

        res.json({ data: omitPassword(admin) });
    } catch (error) {
        res.status(500).json({ error: "Error interno del servidor" });
    }
};

const createAdministrativo = async (req, res) => {
    try {
        const { id, name, email, password, rol, area } = req.body;
        
        await Administrativo.create({
            id: parseInt(id),
            name,
            email,
            password,
            rol,
            area
        });

        res.redirect('/api/administrativos');
    } catch (error) {
        console.log("Error al crear:", error);
        if (error.code === 11000) {
            return res.status(400).send("El ID de administrativo ya existe");
        }
        res.status(500).send("Error interno del servidor");
    }
};

const updateAdministrativo = async (req, res) => {
    try {
        const { name, email, password, rol, area } = req.body;
        
        const datosAActualizar = {};
        if (name) datosAActualizar.name = name;
        if (email) datosAActualizar.email = email;
        if (password) datosAActualizar.password = password;
        if (rol) datosAActualizar.rol = rol;
        if (area) datosAActualizar.area = area;

        const adminActualizado = await Administrativo.findOneAndUpdate(
            { id: parseInt(req.params.id) }, 
            datosAActualizar
        );

        if (!adminActualizado) return res.status(404).send("Administrativo no encontrado");

        res.redirect('/api/administrativos');
    } catch (error) {
        res.status(500).send("Error al actualizar");
    }
};

const deleteAdministrativo = async (req, res) => {
    try {
        const adminEliminado = await Administrativo.findOneAndDelete({ id: parseInt(req.params.id) });
        
        if (!adminEliminado) return res.status(404).send("Administrativo no encontrado");

        res.redirect('/api/administrativos');
    } catch (error) {
        res.status(500).send("Error al eliminar");
    }
};

export default {
    getAdministrativos,
    getAdministrativoById,
    createAdministrativo,
    updateAdministrativo,
    deleteAdministrativo
};