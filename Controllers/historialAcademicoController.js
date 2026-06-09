import HistorialAcademico from '../models/HistorialAcademico.js';
import Alumno from '../models/Alumno.js';
import Materia from '../models/Materia.js';
import Cohorte from '../models/Cohorte.js';

// HELPER MongoDB: Cruza los IDs con los nombres reales
const poblarHistorial = async (registros) => {
    const alumnos = await Alumno.find().lean();
    const materias = await Materia.find().lean();
    const cohortes = await Cohorte.find().lean();

    return registros.map(registro => {
        const alumno = alumnos.find(a => a.id === registro.alumno_id);
        const materia = materias.find(m => m.id === registro.materia_id);

        // Buscamos la cohorte usando el cohorte_id que tiene guardado el alumno
        const cohorte = (alumno && alumno.cohorte_id) 
            ? cohortes.find(c => c.id === alumno.cohorte_id) 
            : null;

        return {
            id_registro: registro.id,
            alumno: alumno ? alumno.name : "Alumno Desconocido",
            cohorte: cohorte ? cohorte.name : "Sin Cohorte Asignada",
            materia: materia ? materia.nombre : "Materia Desconocida",
            anio: materia ? materia.anio : null,
            estado: registro.estado,
            nota: registro.nota
        };
    });
};

export const getHistorial = async (req, res) => {
    try {
        const lista = await HistorialAcademico.find().lean();
        const alumnos = await Alumno.find().lean();
        const materias = await Materia.find().lean();
        const cohortes = await Cohorte.find().lean();

        const historialAgrupado = alumnos.map(alumno => {
            // Buscamos la cohorte del alumno actual
            const cohorte = alumno.cohorte_id 
                ? cohortes.find(c => c.id === alumno.cohorte_id) 
                : null;

            const registrosAlumno = lista
                .filter(r => r.alumno_id === alumno.id)
                .map(r => {
                    const materia = materias.find(m => m.id === r.materia_id);
                    return {
                        materia: materia ? materia.nombre : "Materia Desconocida",
                        anio: materia ? materia.anio : null,
                        estado: r.estado,
                        nota: r.nota
                    };
                })
                .sort((a, b) => a.anio - b.anio);

            return {
                alumno: alumno.name,
                cohorte: cohorte ? cohorte.name : "Sin Cohorte Asignada",
                registros: registrosAlumno
            };
        });

        // Filtramos para mostrar solo a los alumnos que tienen al menos un registro
        const historialFiltrado = historialAgrupado.filter(h => h.registros.length > 0);

        res.json({ message: 'Historial Académico Global', data: historialFiltrado });
    } catch (error) {
        res.status(500).json({ error: "Error obteniendo el historial global" });
    }
};

export const getHistorialByAlumno = async (req, res) => {
    try {
        const { alumnoId } = req.params;
        const historialAlumno = await HistorialAcademico.find({ alumno_id: parseInt(alumnoId) }).lean();

        if (historialAlumno.length === 0) {
            return res.status(404).json({ error: `No se encontró historial para el alumno ID: ${alumnoId}` });
        }

        const historialCompleto = await poblarHistorial(historialAlumno);
        res.json({ message: `Historial del alumno ID: ${alumnoId}`, data: historialCompleto });
    } catch (error) {
        res.status(500).json({ error: "Error obteniendo el historial del alumno" });
    }
};

export const createRegistro = async (req, res) => {
    try {
        const datos = req.body;
        const estadosValidos = ['Cursando', 'Regular', 'Aprobada'];

        // Carga masiva (Insert Many)
        if (Array.isArray(datos)) {
            const registroInvalido = datos.find(d => !estadosValidos.includes(d.estado));
            if (registroInvalido) {
                return res.status(400).json({ error: `El estado '${registroInvalido.estado}' no es válido. Solo se acepta Cursando, Regular o Aprobada.` });
            }
            
            const nuevosRegistros = await HistorialAcademico.insertMany(datos);
            return res.status(201).json({ message: 'Registros creados masivamente', data: nuevosRegistros });
        }

        // Carga individual
        const { id, alumno_id, materia_id, estado, nota = null } = datos;

        if (!id || !alumno_id || !materia_id || !estado) {
            return res.status(400).json({ error: "Faltan datos obligatorios" });
        }

        if (!estadosValidos.includes(estado)) {
            return res.status(400).json({ error: "El estado solo puede ser 'Cursando', 'Regular' o 'Aprobada'" });
        }

        const nuevoRegistro = await HistorialAcademico.create({ id: parseInt(id), alumno_id, materia_id, estado, nota });
        res.status(201).json({ message: 'Registro creado exitosamente', data: nuevoRegistro });

    } catch (error) {
        if (error.code === 11000) return res.status(400).json({ error: "El ID del registro ya existe" });
        res.status(500).json({ error: "Error al crear el registro" });
    }
};

export const updateRegistro = async (req, res) => {
    try {
        const { id } = req.params;
        const { estado, nota } = req.body;

        const datosAActualizar = {};

        if (estado) {
            const estadosValidos = ['Cursando', 'Regular', 'Aprobada'];
            if (!estadosValidos.includes(estado)) {
                return res.status(400).json({ error: "El estado solo puede ser 'Cursando', 'Regular' o 'Aprobada'" });
            }
            datosAActualizar.estado = estado;
        }

        if (nota !== undefined) datosAActualizar.nota = nota;

        const registroActualizado = await HistorialAcademico.findOneAndUpdate(
            { id: parseInt(id) },
            datosAActualizar,
            { new: true }
        );

        if (!registroActualizado) return res.status(404).json({ error: "Registro no encontrado" });
        res.json({ message: "Registro actualizado", data: registroActualizado });

    } catch (error) {
        res.status(500).json({ error: "Error al actualizar el registro" });
    }
};

export const deleteRegistro = async (req, res) => {
    try {
        const { id } = req.params;
        const eliminado = await HistorialAcademico.findOneAndDelete({ id: parseInt(id) });
        
        if (!eliminado) {
            return res.status(404).json({ error: "Registro no encontrado" });
        }
        
        res.json({ message: "Registro eliminado del historial", data: eliminado });
    } catch (error) {
        res.status(500).json({ error: "Error al eliminar el registro" });
    }
};

export default { 
    getHistorial,
    getHistorialByAlumno,
    createRegistro,
    updateRegistro,
    deleteRegistro
};