import Alumno from '../models/Alumno.js';

// Helper: quita la contraseña antes de devolver el JSON
const omitPassword = (alumno) => {
    const alumnoObj = alumno.toObject(); 
    const { password, ...alumnoSinPassword } = alumnoObj;
    return alumnoSinPassword;
};

export const getAlumnos = async (req, res) => {
    try {
        const listaAlumnos = await Alumno.find();
        const alumnosSinPassword = listaAlumnos.map(omitPassword);
        
        res.json({ message: 'Lista de alumnos', data: alumnosSinPassword });
    } catch (error) {
        res.status(500).json({ error: "Error obteniendo alumnos" });
    }
};

export const getAlumnoById = async (req, res) => {
    try {
        const { id } = req.params;
        const alumno = await Alumno.findOne({ id: parseInt(id) });
        
        if (!alumno) {
            return res.status(404).json({ error: "Alumno no encontrado" });
        }
        
        res.json({ message: `Detalles del alumno con ID: ${id}`, data: omitPassword(alumno) });
    } catch (error) {
        res.status(500).json({ error: "Error interno del servidor" });
    }
};

export const createAlumno = async (req, res) => {
    try {
        const { id, name, email, password, legajo, activo, fecha_inscripcion } = req.body;

        if (!id || !name || !email || !password || !legajo || activo === undefined || !fecha_inscripcion) {
            return res.status(400).json({ error: "Faltan datos obligatorios" });
        }

        const nuevoAlumno = await Alumno.create({
            id: parseInt(id),
            name,
            email,
            password,
            legajo,
            activo,
            fecha_inscripcion
        });

        res.status(201).json({ message: 'Alumno creado exitosamente', data: omitPassword(nuevoAlumno) });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ error: "El ID o el Legajo ya existen en la base de datos" });
        }
        res.status(500).json({ error: "Error interno del servidor" });
    }
};

export const updateAlumno = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, password, legajo, activo, fecha_inscripcion } = req.body;

        const datosAActualizar = {};
        if (name) datosAActualizar.name = name;
        if (email) datosAActualizar.email = email;
        if (password) datosAActualizar.password = password; 
        if (legajo) datosAActualizar.legajo = legajo;
        if (activo !== undefined) datosAActualizar.activo = activo;
        if (fecha_inscripcion) datosAActualizar.fecha_inscripcion = new Date(fecha_inscripcion);

        const alumnoActualizado = await Alumno.findOneAndUpdate(
            { id: parseInt(id) }, 
            datosAActualizar, 
            { new: true } 
        );

        if (!alumnoActualizado) {
            return res.status(404).json({ error: "Alumno no encontrado" });
        }

        res.json({ message: "Alumno actualizado", data: omitPassword(alumnoActualizado) });
    } catch (error) {
        res.status(500).json({ error: "Error al actualizar alumno" });
    }
};

export const deleteAlumno = async (req, res) => {
    try {
        const { id } = req.params;
        const alumnoEliminado = await Alumno.findOneAndDelete({ id: parseInt(id) });
        
        if (!alumnoEliminado) return res.status(404).json({ error: "Alumno no encontrado" });

        res.json({ message: "Alumno eliminado", data: omitPassword(alumnoEliminado) });
    } catch (error) {
        res.status(500).json({ error: "Error al eliminar alumno" });
    }
};