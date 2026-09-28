import Administrativo from '../models/Administrativo.js';
import { requireRole, verifyToken } from '../middlewares/authHybrid.js';
import { parseLocalDate } from '../utils/dateUtils.js';
import Alumno from '../models/Alumno.js';


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

export const updateAlumno = async (req, res, next) => {
    try {
        const { id } = req.params;
        // NUEVO: Extraemos el dni del body en caso de que lo estén editando
        const { dni, name, email, password, legajo, activo, fecha_inscripcion } = req.body;

        const datosAActualizar = {};
        if (dni) datosAActualizar.dni = dni; // NUEVO: Agregamos el DNI al objeto de actualización si fue enviado
        if (name) datosAActualizar.name = name;
        if (email) datosAActualizar.email = email;
        if (password) datosAActualizar.password = password; 
        if (legajo) datosAActualizar.legajo = legajo;
        if (activo !== undefined) datosAActualizar.activo = activo;
        if (fecha_inscripcion) datosAActualizar.fecha_inscripcion = parseLocalDate(fecha_inscripcion);

        const alumnoActualizado = await Alumno.findOneAndUpdate(
            { id: parseInt(id) }, 
            datosAActualizar, 
            { new: true } 
        );

        if (!alumnoActualizado) {
            const error = new Error('Alumno no encontrado');
            error.status = 400;
            return next(error);
        }

        //NUEVO: Empujar cambios a Google Sheets con mensajes de diagnóstico para la consola
        console.log("Intentando sincronizar con Sheets...");
        console.log("Cohorte ID:", alumnoActualizado.cohorte_id);
        console.log("Tokens de Google presentes?:", req.user?.googleTokens ? "Sí" : "NO");

        if (alumnoActualizado.cohorte_id) {
            if (req.user && req.user.googleTokens) {
                const cohorte = await Cohorte.findOne({ id: alumnoActualizado.cohorte_id });
                
                if (cohorte && cohorte.spreadsheetId) {
                    try {
                        await actualizarAlumnoEnPlanilla(cohorte.spreadsheetId, req.user.googleTokens, alumnoActualizado);
                        console.log("¡Éxito! Sheets actualizado.");
                    } catch (errorSheets) {
                        console.error("Aviso: No se pudo actualizar Google Sheets:", errorSheets.message);
                    }
                } else {
                    console.log("La cohorte no tiene un Excel vinculado todavía.");
                }
            } else {
                console.log("ERROR: Faltan los tokens de Google en esta ruta para poder escribir en Sheets.");
            }
        }

        res.json({ message: "Alumno actualizado", data: omitPassword(alumnoActualizado) });
    } catch (error) {
        // NUEVO: Sumamos la captura del error 11000 por si en la edición intentan poner un DNI que ya usa otro
        if (error.code === 11000) {
            const error = new Error('El DNI o el Legajo ya existen en la base de datos');
            error.status = 400;
            return next(error);
        }
        next(error);
    }
};

export default {
    getAdministrativos,
    getAdministrativoById,
    createAdministrativo,
    updateAdministrativo,
    deleteAdministrativo,
    updateAlumno
};