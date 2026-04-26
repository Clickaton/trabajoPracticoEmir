const Materia = require('../models/Materia.js'); 
const fs = require('fs');
const path = require('path');

const materiasFilePath = path.join(__dirname, '../data/materias.json');

const readMaterias = () => {
    const data = fs.readFileSync(materiasFilePath, 'utf-8');
    return JSON.parse(data);
};

const writeMaterias = (data) => {
    fs.writeFileSync(materiasFilePath, JSON.stringify(data, null, 2));
};

exports.getMaterias = (req, res) => {
    const listaMaterias = readMaterias();
    res.json({ message: 'Lista de materias', data: listaMaterias });
};

exports.getMateriaById = (req, res) => {
    const { id } = req.params;
    const listaMaterias = readMaterias();
    const materia = listaMaterias.find(m => m.id === parseInt(id));
    if (!materia) {
        return res.status(404).json({ error: "Materia no encontrada" });
    }
    res.json({ message: `Detalles de la materia con ID: ${id}`, materia: materia });
};

exports.createMateria = (req, res) => {
    // Validamos usando las propiedades del modelo de Materia
    const { id, nombre, anio } = req.body;
    if (!id || !nombre || !anio) {
        return res.status(400).json({ error: "Faltan datos obligatorios" });
    }
    const listaMaterias = readMaterias();
    // Instanciamos usando el modelo importado
    const nuevaMateria = new Materia(id, nombre, anio);
    listaMaterias.push(nuevaMateria);
    writeMaterias(listaMaterias);
    res.json({ message: 'Materia creada exitosamente', materia: nuevaMateria });
};

exports.updateMateria = (req, res) => {
    const { id } = req.params;
    const { nombre, anio } = req.body;
    let listaMaterias = readMaterias();
    const materia = listaMaterias.find(m => m.id === parseInt(id));
    if (!materia) return res.status(404).json({ error: "Materia no encontrada" });

    // Actualizamos solo lo que venga en el body
    if (nombre) materia.nombre = nombre;
    if (anio) materia.anio = anio;

    writeMaterias(listaMaterias);
    res.json({ message: "Materia actualizada", materia: materia });
};

exports.deleteMateria = (req, res) => {
    const { id } = req.params;
    let listaMaterias = readMaterias();
    const index = listaMaterias.findIndex(m => m.id === parseInt(id));
    
    if (index === -1) return res.status(404).json({ error: "Materia no encontrada" });

    const eliminada = listaMaterias.splice(index, 1);
    writeMaterias(listaMaterias);
    res.json({ message: "Materia eliminada", materia: eliminada });
};