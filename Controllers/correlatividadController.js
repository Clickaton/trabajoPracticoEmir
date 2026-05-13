import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Correlatividad from '../models/Correlatividad.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const correlividadesFilePath = path.join(__dirname, '../data/correlatividades.json');
const materiasFilePath = path.join(__dirname, '../data/materias.json');

// Lectura y escritura de archivos
const readCorrelatividades = async () => {
    const data = await fs.readFile(correlividadesFilePath, 'utf-8');
    return JSON.parse(data);
};

const writeCorrelatividades = async (data) => {
    await fs.writeFile(correlividadesFilePath, JSON.stringify(data, null, 2));
};

const readMaterias = async () => {
    const data = await fs.readFile(materiasFilePath, 'utf-8');
    return JSON.parse(data);
};

// HELPER: Cruza los IDs con los nombres reales de las materias
const poblarCorrelatividad = (regla, todasLasMaterias) => {
    if (!todasLasMaterias) {
        return { id_regla: regla.id, error: "No se pudieron cargar los nombres de las materias" };
    }

    const materiaDestino  = todasLasMaterias.find(m => m.id === regla.materia_id);
    const materiaRequisito = todasLasMaterias.find(m => m.id === regla.requisito_id);

    return {
        id_regla:  regla.id,
        materia:   materiaDestino  ? materiaDestino.nombre  : "Materia Desconocida",
        requisito: materiaRequisito ? materiaRequisito.nombre : "Materia Desconocida",
        condicion: regla.tipo_requisito
    };
};

// Obtener todas las reglas
const getCorrelatividades = async (req, res) => {
    const lista = await readCorrelatividades();
    const materias = await readMaterias();
    const reglasCompletas = lista.map(regla => poblarCorrelatividad(regla, materias));
    res.json({ message: 'Lista de reglas de correlatividades', data: reglasCompletas });
};

// Obtener los requisitos de UNA materia
const getRequisitosByMateria = async (req, res) => {
    const { materiaId } = req.params;
    const lista = await readCorrelatividades();
    const materias = await readMaterias();
    const requisitos = lista.filter(c => c.materia_id === parseInt(materiaId));

    if (requisitos.length === 0) {
        return res.json({ message: `La materia ID: ${materiaId} no tiene correlatividades`, data: [] });
    }

    const requisitosCompletos = requisitos.map(regla => poblarCorrelatividad(regla, materias));
    res.json({ message: `Requisitos para la materia ID: ${materiaId}`, data: requisitosCompletos });
};

// Obtener una regla por su ID
const getCorrelatividadById = async (req, res) => {
    const { id } = req.params;
    const lista = await readCorrelatividades();
    const materias = await readMaterias();
    const regla = lista.find(c => c.id === parseInt(id));

    if (!regla) return res.status(404).json({ error: "Regla no encontrada" });

    res.json({ message: `Detalle de la regla ID: ${id}`, data: poblarCorrelatividad(regla, materias) });
};

// Crear una nueva regla
const createCorrelatividad = async (req, res) => {
    const { id, materia_id, requisito_id, tipo_requisito } = req.body;

    if (!id || !materia_id || !requisito_id || !tipo_requisito) {
        return res.status(400).json({ error: "Faltan datos obligatorios" });
    }

    if (tipo_requisito !== 'Regular' && tipo_requisito !== 'Aprobada') {
        return res.status(400).json({ error: "El tipo_requisito solo puede ser 'Regular' o 'Aprobada'" });
    }

    if (materia_id === requisito_id) {
        return res.status(400).json({ error: "Una materia no puede ser requisito de sí misma" });
    }

    const lista = await readCorrelatividades();
    const nuevaRegla = new Correlatividad(id, materia_id, requisito_id, tipo_requisito);
    lista.push(nuevaRegla);
    await writeCorrelatividades(lista);

    res.status(201).json({ message: 'Regla creada exitosamente', data: nuevaRegla });
};

// Actualizar una regla
const updateCorrelatividad = async (req, res) => {
    const { id } = req.params;
    const { materia_id, requisito_id, tipo_requisito } = req.body;

    const lista = await readCorrelatividades();
    const regla = lista.find(c => c.id === parseInt(id));
    if (!regla) return res.status(404).json({ error: "Regla no encontrada" });

    if (tipo_requisito && tipo_requisito !== 'Regular' && tipo_requisito !== 'Aprobada') {
        return res.status(400).json({ error: "El tipo_requisito solo puede ser 'Regular' o 'Aprobada'" });
    }

    if (materia_id) regla.materia_id = materia_id;
    if (requisito_id) regla.requisito_id = requisito_id;
    if (tipo_requisito) regla.tipo_requisito = tipo_requisito;

    if (regla.materia_id === regla.requisito_id) {
        return res.status(400).json({ error: "Actualización inválida: Una materia no puede ser requisito de sí misma" });
    }

    await writeCorrelatividades(lista);
    res.json({ message: "Regla actualizada", data: regla });
};

// Eliminar una regla
const deleteCorrelatividad = async (req, res) => {
    const { id } = req.params;
    const lista = await readCorrelatividades();
    const index = lista.findIndex(c => c.id === parseInt(id));

    if (index === -1) return res.status(404).json({ error: "Regla no encontrada" });

    const [eliminada] = lista.splice(index, 1);
    await writeCorrelatividades(lista);
    res.json({ message: "Regla eliminada", data: eliminada });
};

export default {
    getCorrelatividades,
    getRequisitosByMateria,
    getCorrelatividadById,
    createCorrelatividad,
    updateCorrelatividad,
    deleteCorrelatividad
};