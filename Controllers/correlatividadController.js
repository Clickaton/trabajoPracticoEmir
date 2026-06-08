import Correlatividad from '../models/Correlatividad.js';
import Materia from '../models/Materia.js'; // Importamos Materia para buscar los nombres

// HELPER MongoDB: Trae los nombres reales cruzando IDs
const poblarReglas = async (reglas) => {
    // Buscamos todas las materias una sola vez para no saturar la base de datos
    const todasLasMaterias = await Materia.find().lean();

    return reglas.map(regla => {
        const materiaDestino = todasLasMaterias.find(m => m.id === regla.materia_id);
        const materiaRequisito = todasLasMaterias.find(m => m.id === regla.requisito_id);

        return {
            id_regla: regla.id,
            materia: materiaDestino ? materiaDestino.nombre : "Materia Desconocida",
            requisito: materiaRequisito ? materiaRequisito.nombre : "Materia Desconocida",
            condicion: regla.tipo_requisito
        };
    });
};

export const getCorrelatividades = async (req, res) => {
    try {
        const lista = await Correlatividad.find().lean();
        const reglasCompletas = await poblarReglas(lista);
        res.json({ message: 'Lista de reglas de correlatividades', data: reglasCompletas });
    } catch (error) {
        res.status(500).json({ error: "Error obteniendo correlatividades" });
    }
};

export const getRequisitosByMateria = async (req, res) => {
    try {
        const { materiaId } = req.params;
        const requisitos = await Correlatividad.find({ materia_id: parseInt(materiaId) }).lean();

        if (requisitos.length === 0) {
            return res.json({ message: `La materia ID: ${materiaId} no tiene correlatividades`, data: [] });
        }

        const requisitosCompletos = await poblarReglas(requisitos);
        res.json({ message: `Requisitos para la materia ID: ${materiaId}`, data: requisitosCompletos });
    } catch (error) {
        res.status(500).json({ error: "Error obteniendo requisitos" });
    }
};

export const getCorrelatividadById = async (req, res) => {
    try {
        const { id } = req.params;
        const regla = await Correlatividad.findOne({ id: parseInt(id) }).lean();

        if (!regla) return res.status(404).json({ error: "Regla no encontrada" });

        const reglaPoblada = await poblarReglas([regla]);
        res.json({ message: `Detalle de la regla ID: ${id}`, data: reglaPoblada[0] });
    } catch (error) {
        res.status(500).json({ error: "Error obteniendo la regla" });
    }
};

export const createCorrelatividad = async (req, res) => {
    try {
        const datos = req.body;

        // Soporte para carga masiva (Insert Many)
        if (Array.isArray(datos)) {
            // Validamos que ninguna tenga materia_id igual a requisito_id
            const reglaInvalida = datos.find(d => d.materia_id === d.requisito_id);
            if (reglaInvalida) {
                return res.status(400).json({ error: "Una materia no puede ser requisito de sí misma" });
            }
            
            const nuevasReglas = await Correlatividad.insertMany(datos);
            return res.status(201).json({ message: 'Reglas creadas masivamente', data: nuevasReglas });
        }

        // Carga individual
        const { id, materia_id, requisito_id, tipo_requisito } = datos;

        if (!id || !materia_id || !requisito_id || !tipo_requisito) {
            return res.status(400).json({ error: "Faltan datos obligatorios" });
        }
        if (materia_id === requisito_id) {
            return res.status(400).json({ error: "Una materia no puede ser requisito de sí misma" });
        }

        const nuevaRegla = await Correlatividad.create({ id: parseInt(id), materia_id, requisito_id, tipo_requisito });
        res.status(201).json({ message: 'Regla creada exitosamente', data: nuevaRegla });

    } catch (error) {
        if (error.code === 11000) return res.status(400).json({ error: "El ID de la regla ya existe" });
        res.status(500).json({ error: "Error al crear regla(s)" });
    }
};

export const updateCorrelatividad = async (req, res) => {
    try {
        const { id } = req.params;
        const { materia_id, requisito_id, tipo_requisito } = req.body;

        // Validación para evitar que la materia sea requisito de sí misma
        if (materia_id && requisito_id && materia_id === requisito_id) {
            return res.status(400).json({ error: "Actualización inválida: Una materia no puede ser requisito de sí misma" });
        }

        const datosAActualizar = {};
        if (materia_id) datosAActualizar.materia_id = materia_id;
        if (requisito_id) datosAActualizar.requisito_id = requisito_id;
        if (tipo_requisito) datosAActualizar.tipo_requisito = tipo_requisito;

        const reglaActualizada = await Correlatividad.findOneAndUpdate(
            { id: parseInt(id) },
            datosAActualizar,
            { new: true }
        );

        if (!reglaActualizada) return res.status(404).json({ error: "Regla no encontrada" });
        res.json({ message: "Regla actualizada", data: reglaActualizada });

    } catch (error) {
        res.status(500).json({ error: "Error al actualizar la regla" });
    }
};

export const deleteCorrelatividad = async (req, res) => {
    try {
        const { id } = req.params;
        const eliminada = await Correlatividad.findOneAndDelete({ id: parseInt(id) });

        if (!eliminada) return res.status(404).json({ error: "Regla no encontrada" });
        res.json({ message: "Regla eliminada", data: eliminada });
        
    } catch (error) {
        res.status(500).json({ error: "Error al eliminar la regla" });
    }
};

export default {
    getCorrelatividades,
    getRequisitosByMateria,
    getCorrelatividadById,
    createCorrelatividad,
    updateCorrelatividad,
    deleteCorrelatividad
};