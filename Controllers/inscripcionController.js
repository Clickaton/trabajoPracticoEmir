import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Inscripcion from '../models/Inscripcion.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inscripcionesFilePath   = path.join(__dirname, '../data/inscripciones.json');
const alumnosFilePath         = path.join(__dirname, '../data/alumnos.json');
const materiasFilePath        = path.join(__dirname, '../data/materias.json');
const cohortesFilePath        = path.join(__dirname, '../data/cohortes.json');
const periodosFilePath        = path.join(__dirname, '../data/periodoInscripcion.json');
const correlividadesFilePath  = path.join(__dirname, '../data/correlatividades.json');
const historialFilePath       = path.join(__dirname, '../data/historialAcademico.json');

const readInscripciones  = async () => JSON.parse(await fs.readFile(inscripcionesFilePath, 'utf-8'));
const readAlumnos        = async () => JSON.parse(await fs.readFile(alumnosFilePath, 'utf-8'));
const readMaterias       = async () => JSON.parse(await fs.readFile(materiasFilePath, 'utf-8'));
const readCohortes       = async () => JSON.parse(await fs.readFile(cohortesFilePath, 'utf-8'));
const readPeriodos       = async () => JSON.parse(await fs.readFile(periodosFilePath, 'utf-8'));
const readCorrelatividades = async () => JSON.parse(await fs.readFile(correlividadesFilePath, 'utf-8'));
const readHistorial      = async () => JSON.parse(await fs.readFile(historialFilePath, 'utf-8'));

const writeInscripciones = async (data) => await fs.writeFile(inscripcionesFilePath, JSON.stringify(data, null, 2));
const writeHistorial     = async (data) => await fs.writeFile(historialFilePath, JSON.stringify(data, null, 2));

// Obtener todas las inscripciones agrupadas por cohorte y año de materia
const getInscripciones = async (req, res) => {
    const inscripciones = await readInscripciones();
    const alumnos       = await readAlumnos();
    const materias      = await readMaterias();
    const cohortes      = await readCohortes();
    const periodos      = await readPeriodos();

    const resultado = cohortes.map(cohorte => {
        const inscripcionesCohorte = inscripciones.filter(i => i.cohorte_id === cohorte.id);

        // Agrupamos por año de materia
        const porAnio = [1, 2, 3].map(anio => {
            const materiasAnio = inscripcionesCohorte.filter(i => {
                const materia = materias.find(m => m.id === i.materia_id);
                return materia && materia.anio === anio;
            }).map(i => {
                const alumno  = alumnos.find(a => a.id === i.alumno_id);
                const materia = materias.find(m => m.id === i.materia_id);
                const periodo = periodos.find(p => p.id === i.periodo_id);
                return {
                    alumno:  alumno  ? alumno.name    : "Alumno Desconocido",
                    materia: materia ? materia.nombre : "Materia Desconocida",
                    periodo: periodo ? periodo.nombre : "Período Desconocido",
                    fecha:   i.fecha
                };
            });

            return { anio, inscripciones: materiasAnio };
        });

        return { cohorte: cohorte.name, inscripciones: porAnio };
    });

    res.json({ message: 'Lista de inscripciones', data: resultado });
};

// Obtener inscripciones de un solo alumno
const getInscripcionesByAlumno = async (req, res) => {
    const { alumnoId } = req.params;
    const inscripciones = await readInscripciones();
    const materias      = await readMaterias();
    const periodos      = await readPeriodos();
    const alumnos       = await readAlumnos();

    const alumno = alumnos.find(a => a.id === parseInt(alumnoId));
    if (!alumno) return res.status(404).json({ error: "Alumno no encontrado" });

    const inscripcionesAlumno = inscripciones
        .filter(i => i.alumno_id === parseInt(alumnoId))
        .map(i => {
            const materia = materias.find(m => m.id === i.materia_id);
            const periodo = periodos.find(p => p.id === i.periodo_id);
            return {
                materia: materia ? materia.nombre : "Materia Desconocida",
                anio:    materia ? materia.anio   : null,
                periodo: periodo ? periodo.nombre : "Período Desconocido",
                fecha:   i.fecha
            };
        })
        .sort((a, b) => a.anio - b.anio);

    res.json({ message: `Inscripciones del alumno: ${alumno.name}`, data: inscripcionesAlumno });
};

// Crear una inscripción
const createInscripcion = async (req, res) => {
    const { alumno_id, cohorte_id, materia_id } = req.body;

    if (!alumno_id || !cohorte_id || !materia_id) {
        return res.status(400).json({ error: "Faltan datos obligatorios (alumno_id, cohorte_id, materia_id)" });
    }

    const periodos       = await readPeriodos();
    const alumnos        = await readAlumnos();
    const correlatividades = await readCorrelatividades();
    const historial      = await readHistorial();
    const inscripciones  = await readInscripciones();

    // 1. Verificar que haya un período activo
    const periodoActivo = periodos.find(p => p.activo === true);
    if (!periodoActivo) {
        return res.status(400).json({ error: "No hay períodos de inscripción activos. Inscripciones cerradas." });
    }

    // 2. Verificar que el alumno exista
    const alumno = alumnos.find(a => a.id === parseInt(alumno_id));
    if (!alumno) return res.status(404).json({ error: "Alumno no encontrado" });

    // 3. Verificar correlatividades
    const reglasMateria = correlatividades.filter(c => c.materia_id === parseInt(materia_id));
    for (const regla of reglasMateria) {
        const registroRequisito = historial.find(
            h => h.alumno_id === parseInt(alumno_id) && h.materia_id === regla.requisito_id
        );

        if (!registroRequisito) {
            return res.status(400).json({ error: `No cumple la correlatividad: falta cursar la materia ID ${regla.requisito_id}` });
        }

        if (regla.tipo_requisito === 'Regular' && !['Regular', 'Aprobada'].includes(registroRequisito.estado)) {
            return res.status(400).json({ error: `Necesitás tener Regular la materia ID ${regla.requisito_id}` });
        }

        if (regla.tipo_requisito === 'Aprobada' && registroRequisito.estado !== 'Aprobada') {
            return res.status(400).json({ error: `Necesitás tener Aprobada la materia ID ${regla.requisito_id}` });
        }
    }

    // 4. Verificar que no esté ya inscripto a esa materia en este período
    const yaInscripto = inscripciones.find(
        i => i.alumno_id === parseInt(alumno_id) &&
             i.materia_id === parseInt(materia_id) &&
             i.periodo_id === periodoActivo.id
    );
    if (yaInscripto) return res.status(400).json({ error: "El alumno ya está inscripto a esta materia en el período activo" });

    // Todo ok → crear la inscripción
    const nuevaInscripcion = new Inscripcion(
        inscripciones.length + 1,
        parseInt(alumno_id),
        parseInt(cohorte_id),
        parseInt(materia_id),
        periodoActivo.id
    );
    inscripciones.push(nuevaInscripcion);
    await writeInscripciones(inscripciones);

    // Agregar registro "Cursando" en historialAcademico.json
    const historialActualizado = await readHistorial();
    const nuevoRegistroHistorial = {
        id: historialActualizado.length + 1,
        alumno_id: parseInt(alumno_id),
        materia_id: parseInt(materia_id),
        estado: "Cursando",
        nota: null
    };
    historialActualizado.push(nuevoRegistroHistorial);
    await writeHistorial(historialActualizado);

    res.status(201).json({ message: 'Inscripción realizada exitosamente', data: nuevaInscripcion });
};

// Eliminar una inscripción (solo si el período sigue activo)
const deleteInscripcion = async (req, res) => {
    const { id } = req.params;
    const inscripciones = await readInscripciones();
    const periodos      = await readPeriodos();

    const inscripcion = inscripciones.find(i => i.id === parseInt(id));
    if (!inscripcion) return res.status(404).json({ error: "Inscripción no encontrada" });

    // Verificar que el período sigue activo
    const periodo = periodos.find(p => p.id === inscripcion.periodo_id);
    if (!periodo || !periodo.activo) {
        return res.status(400).json({ error: "No se puede anular la inscripción, el período ya cerró" });
    }

    const index = inscripciones.findIndex(i => i.id === parseInt(id));
    inscripciones.splice(index, 1);
    await writeInscripciones(inscripciones);

    res.json({ message: "Inscripción anulada exitosamente", data: inscripcion });
};

export default {
    getInscripciones,
    getInscripcionesByAlumno,
    createInscripcion,
    deleteInscripcion
};