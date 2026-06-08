// Endpoint de solo lectura que unifica las materias y el historial académico para devolver una vista
// completa del estado del alumno y su porcentaje de carrera.
import Alumno from '../models/Alumno.js';
import Materia from '../models/Materia.js';
import HistorialAcademico from '../models/HistorialAcademico.js';

export const getEstadoAcademico = async (req, res) => {
    try {
        const { alumnoId } = req.params;

        // 1. Verificamos que el alumno exista en MongoDB Atlas
        const alumno = await Alumno.findOne({ id: parseInt(alumnoId) }).lean();
        if (!alumno) {
            return res.status(404).json({ error: "Alumno no encontrado" });
        }

        // 2. Traemos todas las materias del plan de estudios
        const materias = await Materia.find().lean();

        // 3. Traemos todo el historial de este alumno en particular
        const historialAlumno = await HistorialAcademico.find({ alumno_id: parseInt(alumnoId) }).lean();

        // 4. Cruzamos TODAS las materias con el historial en tiempo real
        const estadoMaterias = materias.map(materia => {
            // Buscamos si hay un registro de esta materia en el historial del alumno
            const registro = historialAlumno.find(h => h.materia_id === materia.id);
            
            return {
                nombre: materia.nombre,
                anio: materia.anio,
                estado: registro ? registro.estado : "Pendiente", // Si no hay registro, está Pendiente
                nota: registro ? registro.nota : null
            };
        }).sort((a, b) => a.anio - b.anio); // Ordenamos por año de carrera

        // 5. Calculamos el porcentaje de avance de la carrera
        const totalMaterias = materias.length;
        const materiasAprobadas = estadoMaterias.filter(m => m.estado === "Aprobada").length;
        
        // Evitamos división por cero si la colección de materias estuviera vacía
        const porcentaje_carrera = totalMaterias > 0 
            ? Math.round((materiasAprobadas / totalMaterias) * 100) 
            : 0;

        // 6. Respondemos con el JSON consolidado listo para consumir
        res.json({
            alumno: alumno.name,
            porcentaje_carrera: `${porcentaje_carrera}%`,
            materias: estadoMaterias
        });

    } catch (error) {
        res.status(500).json({ error: "Error interno del servidor al calcular el estado académico" });
    }
};

export default { getEstadoAcademico };