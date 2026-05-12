const HistorialAcademico = require('../models/HistorialAcademico.js');
// Importamos los otros controladores para poder leer sus bases de datos temporales
const materiaController = require('./materiaController.js');
const alumnoController = require('./alumnoController.js');

// Base de datos temporal
let listaHistorial = [
    new HistorialAcademico(1, 101, 1, 'Aprobada'), // Ana (101) aprobó Matemática 1 (1)
    new HistorialAcademico(2, 101, 2, 'Regular'),  // Ana (101) está regular en Programación 1 (2)
    new HistorialAcademico(3, 102, 1, 'Cursando')  // Luis (102) está cursando Matemática 1 (1)
];

// FUNCIÓN HELPER: Cruza los IDs con los nombres reales
const poblarHistorial = (registro) => {
    const todosLosAlumnos = alumnoController.listaAlumnos;
    const todasLasMaterias = materiaController.listaMaterias;

    // Buscamos los datos reales
    const alumno = todosLosAlumnos ? todosLosAlumnos.find(a => a.id === registro.alumno_id) : null;
    const materia = todasLasMaterias ? todasLasMaterias.find(m => m.id === registro.materia_id) : null;

    return {
        id_registro: registro.id,
        alumno: alumno ? alumno.name : "Alumno Desconocido",
        materia: materia ? materia.nombre : "Materia Desconocida",
        estado: registro.estado
    };
};


// EXPORTS (Rutas)

// 1. Obtener TODO el historial (Para el Admin)
exports.getHistorial = (req, res) => {
    const historialCompleto = listaHistorial.map(poblarHistorial);
    res.json({ message: 'Historial Académico Global', data: historialCompleto });
};

// 2. Obtener el historial de un SOLO alumno (Para el Dashboard del estudiante)
exports.getHistorialByAlumno = (req, res) => {
    const { alumnoId } = req.params;
    // Filtramos solo las notas del alumno que nos piden
    const historialAlumno = listaHistorial.filter(h => h.alumno_id === parseInt(alumnoId));
    
    // Le aplicamos los nombres lindos
    const historialCompleto = historialAlumno.map(poblarHistorial);
    
    res.json({ message: `Historial del alumno ID: ${alumnoId}`, data: historialCompleto });
};

// 3. Crear un nuevo registro (El profesor carga una nota)
exports.createRegistro = (req, res) => {
    const { id, alumno_id, materia_id, estado } = req.body;

    if (!id || !alumno_id || !materia_id || !estado) {
        return res.status(400).json({ error: "Faltan datos obligatorios" });
    }

    // Validación de seguridad para que no inventen estados
    const estadosValidos = ['Cursando', 'Regular', 'Aprobada'];
    if (!estadosValidos.includes(estado)) {
        return res.status(400).json({ error: "El estado solo puede ser 'Cursando', 'Regular' o 'Aprobada'" });
    }

    const nuevoRegistro = new HistorialAcademico(id, alumno_id, materia_id, estado);
    listaHistorial.push(nuevoRegistro);

    res.status(201).json({ message: 'Registro creado exitosamente', data: nuevoRegistro });
};

// 4. Actualizar un registro (Ej: El alumno rindió el final y pasó de Regular a Aprobada)
exports.updateRegistro = (req, res) => {
    const { id } = req.params;
    const { estado } = req.body; 

    const registro = listaHistorial.find(h => h.id === parseInt(id));
    if (!registro) return res.status(404).json({ error: "Registro no encontrado" });

    if (estado) {
        const estadosValidos = ['Cursando', 'Regular', 'Aprobada'];
        if (!estadosValidos.includes(estado)) {
            return res.status(400).json({ error: "El estado solo puede ser 'Cursando', 'Regular' o 'Aprobada'" });
        }
        registro.estado = estado; // Actualizamos el estado
    }

    res.json({ message: "Registro actualizado", data: registro });
};