import HistorialAcademico from '../models/HistorialAcademico.js';
import { getDB } from '../config/db.js';

const getCollection = () => getDB().collection('historial_academico');

// FUNCIÓN HELPER: Cruza los IDs con los nombres reales
const poblarHistorialArray = async (registros) => {
    const db = getDB();
    const todosLosAlumnos = await db.collection('alumnos').find().toArray();
    const todasLasMaterias = await db.collection('materias').find().toArray();

    return registros.map(registro => {
        const alumno = todosLosAlumnos.find(a => a.id === registro.alumno_id);
        const materia = todasLasMaterias.find(m => m.id === registro.materia_id);

        return {
            id_registro: registro.id,
            alumno: alumno ? alumno.name : "Alumno Desconocido",
            materia: materia ? materia.nombre : "Materia Desconocida",
            estado: registro.estado
        };
    });
};

// 1. Obtener TODO el historial (Para el Admin)
export const getHistorial = async (req, res) => {
    const historial = await getCollection().find().toArray();
    const historialCompleto = await poblarHistorialArray(historial);
    res.json({ message: 'Historial Académico Global', data: historialCompleto });
};

// 2. Obtener el historial de un SOLO alumno (Para el Dashboard del estudiante)
export const getHistorialByAlumno = async (req, res) => {
    const { alumnoId } = req.params;
    const historialAlumno = await getCollection().find({ alumno_id: parseInt(alumnoId) }).toArray();
    const historialCompleto = await poblarHistorialArray(historialAlumno);
    
    res.json({ message: `Historial del alumno ID: ${alumnoId}`, data: historialCompleto });
};

// 3. Crear un nuevo registro (El profesor carga una nota)
export const createRegistro = async (req, res) => {
    const { id, alumno_id, materia_id, estado } = req.body;

    if (!id || !alumno_id || !materia_id || !estado) {
        return res.status(400).json({ error: "Faltan datos obligatorios" });
    }
    const estadosValidos = ['Cursando', 'Regular', 'Aprobada'];
    if (!estadosValidos.includes(estado)) {
        return res.status(400).json({ error: "El estado solo puede ser 'Cursando', 'Regular' o 'Aprobada'" });
    }

    const nuevoRegistro = new HistorialAcademico(parseInt(id), parseInt(alumno_id), parseInt(materia_id), estado);
    await getCollection().insertOne(nuevoRegistro);

    res.status(201).json({ message: 'Registro creado exitosamente', data: nuevoRegistro });
};

// 4. Actualizar un registro (Ej: El alumno rindió el final y pasó de Regular a Aprobada)
export const updateRegistro = async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body; 

    if (estado) {
        const estadosValidos = ['Cursando', 'Regular', 'Aprobada'];
        if (!estadosValidos.includes(estado)) {
            return res.status(400).json({ error: "El estado solo puede ser 'Cursando', 'Regular' o 'Aprobada'" });
        }
        const result = await getCollection().updateOne({ id: parseInt(id) }, { $set: { estado } });
        if (result.matchedCount === 0) return res.status(404).json({ error: "Registro no encontrado" });
    } else {
        const registroExistente = await getCollection().findOne({ id: parseInt(id) });
        if (!registroExistente) return res.status(404).json({ error: "Registro no encontrado" });
    }

    const registroActualizado = await getCollection().findOne({ id: parseInt(id) });
    res.json({ message: "Registro actualizado", data: registroActualizado });
};