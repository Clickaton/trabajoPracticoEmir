import Materia from '../models/Materia.js'; 
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const materiasFilePath = path.join(__dirname, '../data/materias.json');

const readMaterias = async () => {
    const data = await fs.readFile(materiasFilePath, 'utf-8');
    return JSON.parse(data);
};

const writeMaterias = async (data) => {
    await fs.writeFile(materiasFilePath, JSON.stringify(data, null, 2));
};

export const getMaterias = async (req, res) => {
    const listaMaterias = await readMaterias();
    res.json({ message: 'Lista de materias', data: listaMaterias });
};

export const getMateriaById = async (req, res) => {
    const { id } = req.params;
    const listaMaterias = await readMaterias();
    const materia = listaMaterias.find(m => m.id === parseInt(id));
    if (!materia) {
        return res.status(404).json({ error: "Materia no encontrada" });
    }
    res.json({ message: `Detalles de la materia con ID: ${id}`, materia: materia });
};

export const createMateria = async (req, res) => {
    // Validamos usando las propiedades del modelo de Materia
    const { id, nombre, anio } = req.body;
    if (!id || !nombre || !anio) {
        return res.status(400).json({ error: "Faltan datos obligatorios" });
    }
    const listaMaterias = await readMaterias();
    // Instanciamos usando el modelo importado
    const nuevaMateria = new Materia(id, nombre, anio);
    listaMaterias.push(nuevaMateria);
    await writeMaterias(listaMaterias);
    res.json({ message: 'Materia creada exitosamente', materia: nuevaMateria });
};

export const updateMateria = async (req, res) => {
    const { id } = req.params;
    const { nombre, anio } = req.body;
    let listaMaterias = await readMaterias();
    const materia = listaMaterias.find(m => m.id === parseInt(id));
    if (!materia) return res.status(404).json({ error: "Materia no encontrada" });

    // Actualizamos solo lo que venga en el body
    if (nombre) materia.nombre = nombre;
    if (anio) materia.anio = anio;

    await writeMaterias(listaMaterias);
    res.json({ message: "Materia actualizada", materia: materia });
};

export const deleteMateria = async (req, res) => {
    const { id } = req.params;
    let listaMaterias = await readMaterias();
    const index = listaMaterias.findIndex(m => m.id === parseInt(id));
    
    if (index === -1) return res.status(404).json({ error: "Materia no encontrada" });

    const eliminada = listaMaterias.splice(index, 1);
    await writeMaterias(listaMaterias);
    res.json({ message: "Materia eliminada", materia: eliminada });
};