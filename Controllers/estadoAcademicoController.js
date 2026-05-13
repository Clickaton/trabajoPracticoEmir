import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const historialFilePath = path.join(__dirname, '../data/historialAcademico.json');
const alumnosFilePath   = path.join(__dirname, '../data/alumnos.json');
const materiasFilePath  = path.join(__dirname, '../data/materias.json');

const readHistorial = async () => {
    const data = await fs.readFile(historialFilePath, 'utf-8');
    return JSON.parse(data);
};

const readAlumnos = async () => {
    const data = await fs.readFile(alumnosFilePath, 'utf-8');
    return JSON.parse(data);
};

const readMaterias = async () => {
    const data = await fs.readFile(materiasFilePath, 'utf-8');
    return JSON.parse(data);
};

// Endpoint de union: cruza materias + historial del alumno
const getEstadoAcademico = async (req, res) => {
    const { alumnoId } = req.params;

    const alumnos  = await readAlumnos();
    const materias = await readMaterias();
    const historial = await readHistorial();

    // Verificamos que el alumno exista
    const alumno = alumnos.find(a => a.id === parseInt(alumnoId));
    if (!alumno) return res.status(404).json({ error: "Alumno no encontrado" });

    // Filtramos el historial del alumno
    const historialAlumno = historial.filter(h => h.alumno_id === parseInt(alumnoId));

    // Cruzamos TODAS las materias con el historial
    const estadoMaterias = materias.map(materia => {
        const registro = historialAlumno.find(h => h.materia_id === materia.id);
        return {
            nombre: materia.nombre,
            anio:   materia.anio,
            estado: registro ? registro.estado : "Pendiente",
            nota:   registro ? registro.nota   : null
        };
    }).sort((a, b) => a.anio - b.anio);

    // Calculo de porcentaje solo con materiias Aprobadas
    const totalMaterias    = materias.length;
    const materiasAprobadas = estadoMaterias.filter(m => m.estado === "Aprobada").length;
    const porcentaje_carrera = Math.round((materiasAprobadas / totalMaterias) * 100);

    res.json({
        alumno: alumno.name,
        porcentaje_carrera: `${porcentaje_carrera}%`,
        materias: estadoMaterias
    });
};

export default { getEstadoAcademico };