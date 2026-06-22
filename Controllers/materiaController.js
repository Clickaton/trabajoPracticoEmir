import Materia from '../models/Materia.js'; 

export const getMaterias = async (req, res) => {
    try {
        const listaMaterias = await Materia.find();
        res.json({ message: 'Lista de materias', data: listaMaterias });
    } catch (error) {
        res.status(500).json({ error: "Error obteniendo las materias" });
    }
};

export const getMateriaById = async (req, res) => {
    try {
        const { id } = req.params;
        const materia = await Materia.findOne({ id: parseInt(id) });
        
        if (!materia) {
            return res.status(404).json({ error: "Materia no encontrada" });
        }
        
        res.json({ message: `Detalles de la materia con ID: ${id}`, materia: materia });
    } catch (error) {
        res.status(500).json({ error: "Error interno del servidor" });
    }
};

export const createMateria = async (req, res) => {
    try {
        // Soporte extra: Permite recibir un array de materias o una sola
        const datos = req.body;

        if (Array.isArray(datos)) {
            // Si le mandás el JSON completo con las 21 materias, las guarda todas de una
            const nuevasMaterias = await Materia.insertMany(datos);
            return res.status(201).json({ message: 'Materias creadas masivamente', data: nuevasMaterias });
        } else {
            // Comportamiento normal para una sola materia
            const { id, nombre, anio } = datos;
            
            if (!id || !nombre || !anio) {
                return res.status(400).json({ error: "Faltan datos obligatorios (id, nombre, anio)" });
            }

            const nuevaMateria = await Materia.create({ id: parseInt(id), nombre, anio });
            return res.status(201).json({ message: 'Materia creada exitosamente', materia: nuevaMateria });
        }
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ error: "El ID de la materia ya existe en la base de datos" });
        }
        res.status(500).json({ error: "Error interno del servidor" });
    }
};

export const updateMateria = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, anio } = req.body;

        const datosAActualizar = {};
        if (nombre) datosAActualizar.nombre = nombre;
        if (anio) datosAActualizar.anio = anio;

        const materiaActualizada = await Materia.findOneAndUpdate(
            { id: parseInt(id) }, 
            datosAActualizar, 
            { new: true } 
        );

        if (!materiaActualizada) {
            return res.status(404).json({ error: "Materia no encontrada" });
        }

        res.json({ message: "Materia actualizada", materia: materiaActualizada });
    } catch (error) {
        res.status(500).json({ error: "Error al actualizar la materia" });
    }
};

export const deleteMateria = async (req, res) => {
    try {
        const { id } = req.params;
        const materiaEliminada = await Materia.findOneAndDelete({ id: parseInt(id) });
        
        if (!materiaEliminada) {
            return res.status(404).json({ error: "Materia no encontrada" });
        }

        res.json({ message: "Materia eliminada", materia: materiaEliminada });
    } catch (error) {
        res.status(500).json({ error: "Error al eliminar la materia" });
    }
};