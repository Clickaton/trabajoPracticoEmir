import Administrativo from '../models/Administrativo.js';
import { requireRole, verifyToken } from '../middlewares/authHybrid.js';
import { updateAlumno as actualizarAlumno } from './alumnoController.js';


// Helper: quita la contraseña de los objetos traídos de Mongo
const omitPassword = (admin) => {
    // Convertimos el documento de Mongo a un objeto de JS puro
    const adminObj = admin.toObject(); 
    const { password, ...adminSinPassword } = adminObj;
    return adminSinPassword;
};

// RENDERIZAR VISTAS
const getAdministrativos = async (req, res, next) => {
    try {
        const administrativosBBDD = await Administrativo.find();
        
        // Le pedimos a Mongoose que nos lea el array del 'enum' de models administrativo
        const rolesPermitidos = Administrativo.schema.path('rol').enumValues;

        // validación de seguridad (omitPassword).
        // Lo mande abajo la clave "lista" porque así lo configura en el index.pug
        res.render('administrativos/index', { 
            lista: administrativosBBDD.map(omitPassword),
            roles: rolesPermitidos });
    } catch (error) {
        next(error);
    }
};

// PROCESAR DATOS (POST / API)
const getAdministrativoById = async (req, res, next) => {
    try {
        const admin = await Administrativo.findOne({ id: parseInt(req.params.id) });
        if (!admin) {
            const error = new Error('Administrativo no encontrado');
            error.status = 404;
            return next(error);
        } 

        res.json({ data: omitPassword(admin) });
    } catch (error) {
        next(error);
    }
};

const createAdministrativo = async (req, res, next) => {
    try {
        const { name, email, password, rol, area } = req.body;
        
        await Administrativo.create({
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
            console.log("El ID de administrativo ya existe");
        }
        next(error);
    }
};

const updateAdministrativo = async (req, res, next) => {
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

        if (!adminActualizado) {
            const error = new Error('Administrativo no encontrado');
            error.status = 404;
            return next(error);
        }

        res.redirect('/api/administrativos');
    } catch (error) {
        next(error);
    }
};

const deleteAdministrativo = async (req, res, next) => {
    try {
        const adminEliminado = await Administrativo.findOneAndDelete({ id: parseInt(req.params.id) });
        
        if (!adminEliminado) {
            const error = new Error('Administrativo no encontrado');
            error.status = 404;
            return next(error);
        }

        res.redirect('/api/administrativos');
    } catch (error) {
        next(error);
    }
};

// Editar un alumno desde el panel administrativo: se reutiliza la lógica de alumnoController.updateAlumno.
// La copia que había acá usaba Cohorte y actualizarAlumnoEnPlanilla sin importarlos: guardaba los cambios y después
// fallaba con error 500 en cuanto el alumno tenía cohorte, y no conocía los datos de ingreso.
export const updateAlumno = actualizarAlumno;

export default {
    getAdministrativos,
    getAdministrativoById,
    createAdministrativo,
    updateAdministrativo,
    deleteAdministrativo,
    updateAlumno
};