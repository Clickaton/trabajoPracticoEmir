import Correlatividad from '../models/Correlatividad.js';
import { getDB } from '../config/db.js';

const getCollection = () => getDB().collection('correlatividades');

// FUNCION HELPER: Convierte arreglos de reglas en objetos con nombres resueltos
const poblarCorrelatividades = async (reglas) => {
    const todasLasMaterias = await getDB().collection('materias').find().toArray();

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

// Obtener todas las reglas
export const getCorrelatividades = async (req, res) => {
    const listaCorrelatividades = await getCollection().find().toArray();
    const reglasCompletas = await poblarCorrelatividades(listaCorrelatividades);
    res.json({ message: 'Lista de reglas de correlatividades', data: reglasCompletas });
};

// Obtener los requisitos específicos de UNA materia
export const getRequisitosByMateria = async (req, res) => {
    const { materiaId } = req.params;
    const requisitos = await getCollection().find({ materia_id: parseInt(materiaId) }).toArray();
    
    const requisitosCompletos = await poblarCorrelatividades(requisitos);
    res.json({ message: `Requisitos para la materia ID: ${materiaId}`, data: requisitosCompletos });
};

// Obtener una regla por su ID
export const getCorrelatividadById = async (req, res) => {
    const { id } = req.params;
    const regla = await getCollection().findOne({ id: parseInt(id) });
    
    if (!regla) return res.status(404).json({ error: "Regla no encontrada" });
    
    const reglaCompleta = await poblarCorrelatividades([regla]);
    res.json({ message: `Detalle de la regla ID: ${id}`, data: reglaCompleta[0] });
};

// Crear una nueva regla
export const createCorrelatividad = async (req, res) => {
    const { id, materia_id, requisito_id, tipo_requisito } = req.body;

    if (!id || !materia_id || !requisito_id || !tipo_requisito) {
        return res.status(400).json({ error: "Faltan datos obligatorios" });
    }
    if (tipo_requisito !== 'Regular' && tipo_requisito !== 'Aprobada') {
        return res.status(400).json({ error: "El tipo_requisito solo puede ser 'Regular' o 'Aprobada'" });
    }
    if (parseInt(materia_id) === parseInt(requisito_id)) {
        return res.status(400).json({ error: "Una materia no puede ser requisito de sí misma" });
    }

    const nuevaRegla = new Correlatividad(parseInt(id), parseInt(materia_id), parseInt(requisito_id), tipo_requisito);
    await getCollection().insertOne(nuevaRegla);

    res.status(201).json({ message: 'Regla creada exitosamente', data: nuevaRegla });
};

// Actualizar una regla
export const updateCorrelatividad = async (req, res) => {
    const { id } = req.params;
    const { materia_id, requisito_id, tipo_requisito } = req.body;

    const reglaActual = await getCollection().findOne({ id: parseInt(id) });
    if (!reglaActual) return res.status(404).json({ error: "Regla no encontrada" });

    if (tipo_requisito && tipo_requisito !== 'Regular' && tipo_requisito !== 'Aprobada') {
        return res.status(400).json({ error: "El tipo_requisito solo puede ser 'Regular' o 'Aprobada'" });
    }

    const updateData = {};
    if (materia_id) updateData.materia_id = parseInt(materia_id);
    if (requisito_id) updateData.requisito_id = parseInt(requisito_id);
    if (tipo_requisito) updateData.tipo_requisito = tipo_requisito;

    const nuevoMateriaId = updateData.materia_id || reglaActual.materia_id;
    const nuevoRequisitoId = updateData.requisito_id || reglaActual.requisito_id;
    if (nuevoMateriaId === nuevoRequisitoId) {
        return res.status(400).json({ error: "Actualización inválida: Una materia no puede ser requisito de sí misma" });
    }

    await getCollection().updateOne({ id: parseInt(id) }, { $set: updateData });
    const reglaActualizada = await getCollection().findOne({ id: parseInt(id) });

    res.json({ message: "Regla actualizada", data: reglaActualizada });
};

// Eliminar una regla
export const deleteCorrelatividad = async (req, res) => {
    const { id } = req.params;
    const eliminada = await getCollection().findOne({ id: parseInt(id) });
    if (!eliminada) return res.status(404).json({ error: "Regla no encontrada" });

    await getCollection().deleteOne({ id: parseInt(id) });
    res.json({ message: "Regla eliminada", data: eliminada });
};