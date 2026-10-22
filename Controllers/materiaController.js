import Materia from '../models/Materia.js';
import HistorialAcademico from '../models/HistorialAcademico.js';
import Inscripcion from '../models/Inscripcion.js';
import InscripcionFinal from '../models/InscripcionFinal.js';
import Correlatividad from '../models/Correlatividad.js';
import { ordenarMaterias } from '../utils/ordenarMaterias.js';
import { resolverPlanId } from '../services/planService.js';
import { siguienteId } from '../utils/siguienteId.js';

const ANIO_MAXIMO = 10;

// Valida y normaliza los datos propios de una materia. Devuelve { nombre, anio } o { error }.
const validarDatosMateria = ({ nombre, anio }) => {
    const nombreLimpio = typeof nombre === 'string' ? nombre.trim() : '';
    if (!nombreLimpio) return { error: 'El nombre de la materia es obligatorio' };

    const anioNumero = Number(anio);
    if (!Number.isInteger(anioNumero) || anioNumero < 1 || anioNumero > ANIO_MAXIMO) {
        return { error: `El año debe ser un número entero entre 1 y ${ANIO_MAXIMO}` };
    }
    return { nombre: nombreLimpio, anio: anioNumero };
};

// GET /api/materias            -> todas, ordenadas por plan, año y nombre
// GET /api/materias?plan_id=2  -> solo las del plan 2, ordenadas por año y nombre
export const getMaterias = async (req, res) => {
    try {
        const filtro = {};
        if (req.query.plan_id !== undefined && req.query.plan_id !== '') {
            const planId = parseInt(req.query.plan_id, 10);
            if (Number.isNaN(planId)) return res.status(400).json({ error: 'plan_id inválido' });
            filtro.plan_id = planId;
        }

        const lista = await Materia.find(filtro).lean();
        res.json({ message: 'Lista de materias', data: ordenarMaterias(lista, { grupo: (m) => m.plan_id }) });
    } catch (error) {
        res.status(500).json({ error: "Error obteniendo las materias" });
    }
};

export const getMateriaById = async (req, res) => {
    try {
        const { id } = req.params;
        const materia = await Materia.findOne({ id: parseInt(id) });

        if (!materia) {
            return res.status(404).json({ error: "Materia no encontrada" });
        }

        res.json({ message: `Detalles de la materia con ID: ${id}`, materia: materia });
    } catch (error) {
        res.status(500).json({ error: "Error interno del servidor" });
    }
};

export const createMateria = async (req, res) => {
    try {
        const datos = req.body;

        // Carga masiva: permite recibir el JSON completo con todas las materias de un plan
        if (Array.isArray(datos)) {
            if (datos.length === 0) return res.status(400).json({ error: "La lista de materias está vacía" });

            const cachePlanes = new Map(); // plan_id recibido -> plan resuelto (evita consultar el mismo plan N veces)
            const documentos = [];

            for (const [posicion, item] of datos.entries()) {
                const validado = validarDatosMateria(item || {});
                if (validado.error) return res.status(400).json({ error: `Materia ${posicion + 1}: ${validado.error}` });

                const claveCache = String(item.plan_id ?? '');
                if (!cachePlanes.has(claveCache)) cachePlanes.set(claveCache, await resolverPlanId(item.plan_id));
                const { plan, error } = cachePlanes.get(claveCache);
                if (error) return res.status(400).json({ error: `Materia ${posicion + 1}: ${error}` });

                const idManual = item.id !== undefined && item.id !== null && item.id !== '' ? parseInt(item.id, 10) : null;
                if (idManual !== null && (Number.isNaN(idManual) || idManual < 1)) {
                    return res.status(400).json({ error: `Materia ${posicion + 1}: el ID no es válido` });
                }
                documentos.push({ id: idManual, nombre: validado.nombre, anio: validado.anio, plan_id: plan.id });
            }

            // Los IDs automáticos arrancan por encima del mayor ID de la base y del propio lote,
            // así nunca pisan a uno escrito a mano.
            let proximoId = Math.max(await siguienteId(Materia), ...documentos.map((d) => (d.id || 0) + 1));
            for (const doc of documentos) {
                if (doc.id === null) doc.id = proximoId++;
            }

            const nuevasMaterias = await Materia.insertMany(documentos);
            return res.status(201).json({ message: 'Materias creadas masivamente', data: nuevasMaterias });
        }

        // Alta individual
        const validado = validarDatosMateria(datos);
        if (validado.error) return res.status(400).json({ error: validado.error });

        const { plan, error } = await resolverPlanId(datos.plan_id);
        if (error) return res.status(400).json({ error });

        // El ID es opcional: las pantallas anteriores lo enviaban a mano, las nuevas pueden omitirlo
        const idManual = datos.id !== undefined && datos.id !== null && datos.id !== '' ? parseInt(datos.id, 10) : null;
        if (idManual !== null && (Number.isNaN(idManual) || idManual < 1)) {
            return res.status(400).json({ error: "El ID de la materia no es válido" });
        }
        const id = idManual ?? await siguienteId(Materia);

        const nuevaMateria = await Materia.create({ id, nombre: validado.nombre, anio: validado.anio, plan_id: plan.id });
        return res.status(201).json({ message: 'Materia creada exitosamente', materia: nuevaMateria });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ error: "El ID de la materia ya existe en la base de datos" });
        }
        res.status(500).json({ error: "Error interno del servidor" });
    }
};

export const updateMateria = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, anio, plan_id } = req.body;

        const actual = await Materia.findOne({ id: parseInt(id) }).lean();
        if (!actual) {
            return res.status(404).json({ error: "Materia no encontrada" });
        }

        // El plan de una materia no se cambia: el historial y las correlatividades ya dependen de él.
        if (plan_id !== undefined && plan_id !== null && plan_id !== '' && Number(plan_id) !== actual.plan_id) {
            return res.status(400).json({ error: "No se puede mover una materia a otro plan. Creala de nuevo en el plan correcto." });
        }

        const datosAActualizar = {};
        if (nombre !== undefined) {
            const nombreLimpio = typeof nombre === 'string' ? nombre.trim() : '';
            if (!nombreLimpio) return res.status(400).json({ error: "El nombre de la materia no puede quedar vacío" });
            datosAActualizar.nombre = nombreLimpio;
        }
        if (anio !== undefined && anio !== '') {
            const anioNumero = Number(anio);
            if (!Number.isInteger(anioNumero) || anioNumero < 1 || anioNumero > ANIO_MAXIMO) {
                return res.status(400).json({ error: `El año debe ser un número entero entre 1 y ${ANIO_MAXIMO}` });
            }
            datosAActualizar.anio = anioNumero;
        }

        const materiaActualizada = await Materia.findOneAndUpdate(
            { id: parseInt(id) },
            datosAActualizar,
            { new: true }
        );

        if (!materiaActualizada) {
            return res.status(404).json({ error: "Materia no encontrada" });
        }

        res.json({ message: "Materia actualizada", materia: materiaActualizada });
    } catch (error) {
        res.status(500).json({ error: "Error al actualizar la materia" });
    }
};

// Cuántos registros dependen de una materia. Si hay alguno, borrarla dejaría datos huérfanos
// (historiales, inscripciones o reglas que apuntan a una materia que ya no existe).
export const contarDependenciasMateria = async (materiaId) => {
    const [historial, inscripciones, finales, correlatividades] = await Promise.all([
        HistorialAcademico.countDocuments({ materia_id: materiaId }),
        Inscripcion.countDocuments({ materia_id: materiaId }),
        InscripcionFinal.countDocuments({ materia_id: materiaId }),
        // La materia puede ser la que exige o la que se exige a otra
        Correlatividad.countDocuments({ $or: [{ materia_id: materiaId }, { requisito_id: materiaId }] })
    ]);
    return { historial, inscripciones, finales, correlatividades };
};

const cantidad = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`;

const describirDependencias = ({ historial, inscripciones, finales, correlatividades }) => [
    historial > 0 && cantidad(historial, 'registro en historiales académicos', 'registros en historiales académicos'),
    inscripciones > 0 && cantidad(inscripciones, 'inscripción a cursada', 'inscripciones a cursada'),
    finales > 0 && cantidad(finales, 'inscripción a final', 'inscripciones a final'),
    correlatividades > 0 && cantidad(correlatividades, 'correlatividad', 'correlatividades')
].filter(Boolean);

export const deleteMateria = async (req, res) => {
    try {
        const materiaId = parseInt(req.params.id, 10);
        if (Number.isNaN(materiaId)) return res.status(400).json({ error: "El ID de la materia no es válido" });

        const materia = await Materia.findOne({ id: materiaId }).lean();
        if (!materia) {
            return res.status(404).json({ error: "Materia no encontrada" });
        }

        // Una materia en uso no se elimina: se conserva el historial de los alumnos y las reglas del plan
        const dependencias = await contarDependenciasMateria(materiaId);
        const detalle = describirDependencias(dependencias);
        if (detalle.length > 0) {
            return res.status(409).json({
                error: `No se puede eliminar la materia "${materia.nombre}" porque está en uso: ${detalle.join(', ')}. ` +
                    'Solo se pueden eliminar las materias que nadie cursó y que no tienen correlatividades (por ejemplo, para corregir un error de carga).',
                dependencias
            });
        }

        await Materia.findOneAndDelete({ id: materiaId });
        res.json({ message: "Materia eliminada", materia });
    } catch (error) {
        res.status(500).json({ error: "Error al eliminar la materia" });
    }
};
