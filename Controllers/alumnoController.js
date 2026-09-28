import Alumno from '../models/Alumno.js';
import Cohorte from '../models/Cohorte.js'; // IMPORTANTE: Agregamos el modelo Cohorte para poder limpiarlo
import Materia from '../models/Materia.js';
import { actualizarAlumnoEnPlanilla } from '../services/googleSheetsService.js';
import HistorialAcademico from '../models/HistorialAcademico.js';
import PeriodoInscripcion from '../models/PeriodoInscripcion.js';
import { parseLocalDate, parseLocalDateTime } from '../utils/dateUtils.js';


// Helper: quita la contraseña antes de devolver el JSON
const omitPassword = (alumno) => {
    const alumnoObj = alumno.toObject(); 
    const { password, ...alumnoSinPassword } = alumnoObj;
    return alumnoSinPassword;
};

export const getAlumnos = async (req, res, next) => {
    try {
        const listaAlumnos = await Alumno.find();
        const alumnosSinPassword = listaAlumnos.map(omitPassword);
        
        res.json({ message: 'Lista de alumnos', data: alumnosSinPassword });
    } catch (error) {
        next(error);
    }
};

export const getAlumnoById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const alumno = await Alumno.findOne({ id: parseInt(id) });
        
        if (!alumno) {
            const error = new Error('Alumno no encontrado');
            error.status = 404;
            return next(error);
        }
        
        res.json({ message: `Detalles del alumno con ID: ${id}`, data: omitPassword(alumno) });
    } catch (error) {
        next(error);
    }
};

export const getDashboard = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user || user.tipoPerfil !== 'Alumno') {
            return res.redirect('/login');
        }

        const alumno = await Alumno.findOne({ id: parseInt(user.id) });
        if (!alumno) {
            const error = new Error('Alumno no encontrado');
            error.status = 404;
            return next(error);
        }

        const ahora = new Date();
        const periodosActivos = await PeriodoInscripcion.find({ activo: true }).lean();

        const periodoActivo = periodosActivos.find(periodo => {
            const inicio = parseLocalDateTime(periodo.fechaInicio, periodo.horaInicio);
            const fin = parseLocalDateTime(periodo.fechaFin, periodo.horaFin);

            if (!inicio || !fin) return false;

            return ahora >= inicio && ahora <= fin;
        });

        let todasLasMaterias = [];

        if (periodoActivo) {
            todasLasMaterias = await Materia.find().sort({ anio: 1 }).lean();
        }
        
        // Buscamos el historial del alumno
        const historial = await HistorialAcademico.find({ alumno_id: alumno.id }).lean();
        
        // FILTRO CORREGIDO: Solo ocultamos la materia si ya está explícitamente "Aprobada"
        const materiasDisponibles = todasLasMaterias.filter(mat => {
            const estaAprobada = historial.some(h => h.materia_id === mat.id && h.estado === 'Aprobada');
            
            // Si está aprobada, la filtramos (no se muestra). Si no, la mostramos.
            return !estaAprobada; 
        });

        res.render('alumnos/dashboard', { alumno: omitPassword(alumno), materias: materiasDisponibles });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const createAlumno = async (req, res, next) => {
    try {
        // NUEVO: Agregamos 'dni' a la desestructuración de los datos que recibimos del formulario
        const { dni, name, email, password, legajo, activo, fecha_inscripcion, cohorte_id } = req.body;

        // NUEVO: Sumamos '!dni' a la validación para asegurarnos de que no lo envíen vacío
        if (!dni || !name || !email || !password || !legajo || activo === undefined || !fecha_inscripcion) {
            const error = new Error('Faltan datos obligatorios');
            error.status = 400;
            return next(error);
        }

        // 1. Verificamos que la cohorte exista ANTES de crear nada
        let cohorteDestino = null;
        if (cohorte_id) {
            cohorteDestino = await Cohorte.findOne({ id: parseInt(cohorte_id) });
            if (!cohorteDestino) {
                const error = new Error('La cohorte seleccionada no existe en la base de datos');
                error.status = 400;
                return next(error);
            }
        }

        // 2. Creamos al alumno
        const nuevoAlumno = await Alumno.create({
            dni, // NUEVO: Guardamos el DNI en la base de datos
            name,
            email,
            password,
            legajo,
            activo,
            fecha_inscripcion: parseLocalDate(fecha_inscripcion),
            cohorte_id: cohorteDestino ? cohorteDestino.id : null // Asignamos el ID de cohorte
        });

        // 3. Si venía con cohorte, lo metemos en el array de esa cohorte automáticamente
        if (cohorteDestino) {
            cohorteDestino.userList.push(nuevoAlumno.id);
            await cohorteDestino.save();
        }

        res.status(201).json({ message: 'Alumno creado exitosamente', data: omitPassword(nuevoAlumno) });
    } catch (error) {
        if (error.code === 11000) {
            const error = new Error('El DNI o el Legajo ya existen en la base de datos');
            error.status = 400;
            return next(error);
        }
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

export const deleteAlumno = async (req, res, next) => {
    try {
        const { id } = req.params;
        const alumnoIdNumerico = parseInt(id);

        // 1. Borramos al alumno
        const alumnoEliminado = await Alumno.findOneAndDelete({ id: alumnoIdNumerico });
        
        if (!alumnoEliminado) {
            const error = new Error('Alumno no encontrado');
            error.status = 400;
            return next(error);
        }

        // 2. CAZAFANTASMAS: Buscamos cualquier cohorte que tenga a este alumno y lo borramos de su array
        await Cohorte.updateMany(
            { userList: alumnoIdNumerico }, // Condición: si el ID está en la lista
            { $pull: { userList: alumnoIdNumerico } } // Acción: sacarlo de la lista (pull)
        );

        res.json({ message: "Alumno eliminado limpiamente de todo el sistema", data: omitPassword(alumnoEliminado) });
    } catch (error) {
        next(error);
    }
};