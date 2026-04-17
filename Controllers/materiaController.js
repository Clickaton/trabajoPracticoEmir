const Materia = require('../models/Materia.js'); 

// Base de datos temporal
let listaMaterias = [
    { id: 1, nombre: "Matemática 1", anio: 1 },
    { id: 2, nombre: "Programación 1", anio: 1 },
    { id: 3, nombre: "Bases de Datos", anio: 2 },
    { id: 4, nombre: "Diseño de Sistemas", anio: 3 }
];

exports.getMaterias = (req, res) => {
    res.json({ message: 'Lista de materias', data: listaMaterias });
};

exports.getMateriaById = (req, res) => {
    const { id } = req.params;
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
    
    // Instanciamos usando el modelo importado
    const nuevaMateria = new Materia(id, nombre, anio);
    listaMaterias.push(nuevaMateria);
    res.json({ message: 'Materia creada exitosamente', materia: nuevaMateria });
};

exports.updateMateria = (req, res) => {
    const { id } = req.params;
    const { nombre, anio } = req.body;
    
    const materia = listaMaterias.find(m => m.id === parseInt(id));
    if (!materia) return res.status(404).json({ error: "Materia no encontrada" });

    // Actualizamos solo lo que venga en el body
    if (nombre) materia.nombre = nombre;
    if (anio) materia.anio = anio;

    res.json({ message: "Materia actualizada", materia: materia });
};

exports.deleteMateria = (req, res) => {
    const { id } = req.params;
    const index = listaMaterias.findIndex(m => m.id === parseInt(id));
    
    if (index === -1) return res.status(404).json({ error: "Materia no encontrada" });

    const eliminada = listaMaterias.splice(index, 1);
    res.json({ message: "Materia eliminada", materia: eliminada });
};