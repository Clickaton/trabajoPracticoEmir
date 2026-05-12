// Controllers/correlatividadController.js
const Correlatividad = require('../models/Correlatividad.js');
// IMPORTANTE: Agregamos esta línea para poder traer los nombres de las materias
const materiaController = require('./materiaController.js');

// Base de datos temporal
let listaCorrelatividades = [
    new Correlatividad(1, 3, 2, 'Regular'),
    new Correlatividad(2, 4, 3, 'Aprobada')
];

// FUNCION HELPER
const poblarCorrelatividad = (regla) => {
    // Leemos la lista de materias del otro controlador
    const todasLasMaterias = materiaController.listaMaterias;

    // Si por algún motivo listaMaterias no existe, evitamos que el sistema explote
    if (!todasLasMaterias) {
        return { id_regla: regla.id, error: "No se pudieron cargar los nombres de las materias" };
    }

    const materiaDestino = todasLasMaterias.find(m => m.id === regla.materia_id);
    const materiaRequisito = todasLasMaterias.find(m => m.id === regla.requisito_id);

    return {
        id_regla: regla.id,
        materia: materiaDestino ? materiaDestino.nombre : "Materia Desconocida",
        requisito: materiaRequisito ? materiaRequisito.nombre : "Materia Desconocida",
        condicion: regla.tipo_requisito
    };
};

// EXPORTS

// Obtener todas las reglas (Modificado con el helper)
exports.getCorrelatividades = (req, res) => {
    const reglasCompletas = listaCorrelatividades.map(poblarCorrelatividad);
    res.json({ message: 'Lista de reglas de correlatividades', data: reglasCompletas });
};

// Obtener los requisitos específicos de UNA materia (Modificado con el helper)
exports.getRequisitosByMateria = (req, res) => {
    const { materiaId } = req.params;
    const requisitos = listaCorrelatividades.filter(c => c.materia_id === parseInt(materiaId));
    
    const requisitosCompletos = requisitos.map(poblarCorrelatividad);
    
    res.json({ message: `Requisitos para la materia ID: ${materiaId}`, data: requisitosCompletos });
};

// Obtener una regla por su ID
exports.getCorrelatividadById = (req, res) => {
    const { id } = req.params;
    const regla = listaCorrelatividades.find(c => c.id === parseInt(id));
    
    if (!regla) return res.status(404).json({ error: "Regla no encontrada" });
    
    // A este también le podemos aplicar el helper para que quede lindo
    res.json({ message: `Detalle de la regla ID: ${id}`, data: poblarCorrelatividad(regla) });
};

// Crear una nueva regla
exports.createCorrelatividad = (req, res) => {
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

    const nuevaRegla = new Correlatividad(id, materia_id, requisito_id, tipo_requisito);
    listaCorrelatividades.push(nuevaRegla);

    res.status(201).json({ message: 'Regla creada exitosamente', data: nuevaRegla });
};

// Actualizar una regla
exports.updateCorrelatividad = (req, res) => {
    const { id } = req.params;
    const { materia_id, requisito_id, tipo_requisito } = req.body;

    const regla = listaCorrelatividades.find(c => c.id === parseInt(id));
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

    res.json({ message: "Regla actualizada", data: regla });
};

// Eliminar una regla
exports.deleteCorrelatividad = (req, res) => {
    const { id } = req.params;
    const index = listaCorrelatividades.findIndex(c => c.id === parseInt(id));
    
    if (index === -1) return res.status(404).json({ error: "Regla no encontrada" });

    const [eliminada] = listaCorrelatividades.splice(index, 1);
    res.json({ message: "Regla eliminada", data: eliminada });
};