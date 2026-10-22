import Correlatividad from '../models/Correlatividad.js';
import Materia from '../models/Materia.js'; // Importamos Materia para buscar los nombres
import { compararMaterias } from '../utils/ordenarMaterias.js';
import { siguienteId } from '../utils/siguienteId.js';

const TIPOS_REQUISITO = ['Regular', 'Aprobada'];

const esNumeroEntero = (valor) => valor !== undefined && valor !== null && valor !== '' && Number.isInteger(Number(valor));

// HELPER MongoDB: Trae los nombres reales cruzando IDs.
// Devuelve las reglas ordenadas: primero por la materia destino (año, nombre) y luego por su requisito (año, nombre).
const poblarReglas = async (reglas) => {
    // Buscamos todas las materias una sola vez para no saturar la base de datos
    const todasLasMaterias = await Materia.find().lean();

    const filas = reglas.map(regla => {
        const materiaDestino = todasLasMaterias.find(m => m.id === regla.materia_id);
        const materiaRequisito = todasLasMaterias.find(m => m.id === regla.requisito_id);

        return {
            id_regla: regla.id,
            materia_id: regla.materia_id,
            requisito_id: regla.requisito_id,
            plan_id: materiaDestino ? materiaDestino.plan_id : null,
            materia: materiaDestino ? materiaDestino.nombre : "Materia Desconocida",
            materia_anio: materiaDestino ? materiaDestino.anio : null,
            requisito: materiaRequisito ? materiaRequisito.nombre : "Materia Desconocida",
            requisito_anio: materiaRequisito ? materiaRequisito.anio : null,
            condicion: regla.tipo_requisito
        };
    });

    return filas.sort((a, b) =>
        compararMaterias(a, b, { grupo: (f) => f.plan_id, anio: (f) => f.materia_anio, nombre: (f) => f.materia })
        || compararMaterias(a, b, { anio: (f) => f.requisito_anio, nombre: (f) => f.requisito })
    );
};

// Una correlatividad solo tiene sentido entre materias del MISMO plan de estudios.
// `materiasPorId` (opcional) evita consultar la base una vez por regla en las cargas masivas.
const validarMismoPlan = async (materiaId, requisitoId, materiasPorId = null) => {
    const buscar = async (id) => (materiasPorId ? materiasPorId.get(Number(id)) : Materia.findOne({ id: Number(id) }).lean());
    const [materia, requisito] = [await buscar(materiaId), await buscar(requisitoId)];

    if (!materia) return { error: `No existe la materia ${materiaId}` };
    if (!requisito) return { error: `No existe la materia requisito ${requisitoId}` };
    if (materia.plan_id !== requisito.plan_id) {
        return { error: `"${materia.nombre}" y "${requisito.nombre}" pertenecen a planes de estudio distintos: una correlatividad solo puede unir materias del mismo plan` };
    }
    return { materia, requisito };
};

// GET /api/correlatividades            -> todas
// GET /api/correlatividades?plan_id=2  -> solo las de las materias del plan 2
export const getCorrelatividades = async (req, res) => {
    try {
        let lista = await Correlatividad.find().lean();

        if (req.query.plan_id !== undefined && req.query.plan_id !== '') {
            const planId = parseInt(req.query.plan_id, 10);
            if (Number.isNaN(planId)) return res.status(400).json({ error: 'plan_id inválido' });

            const idsDelPlan = new Set((await Materia.find({ plan_id: planId }).select('id').lean()).map(m => m.id));
            lista = lista.filter(r => idsDelPlan.has(r.materia_id));
        }

        const reglasCompletas = await poblarReglas(lista);
        res.json({ message: 'Lista de reglas de correlatividades', data: reglasCompletas });
    } catch (error) {
        res.status(500).json({ error: "Error obteniendo correlatividades" });
    }
};

export const getRequisitosByMateria = async (req, res) => {
    try {
        const { materiaId } = req.params;
        const requisitos = await Correlatividad.find({ materia_id: parseInt(materiaId) }).lean();

        if (requisitos.length === 0) {
            return res.json({ message: `La materia ID: ${materiaId} no tiene correlatividades`, data: [] });
        }

        const requisitosCompletos = await poblarReglas(requisitos);
        res.json({ message: `Requisitos para la materia ID: ${materiaId}`, data: requisitosCompletos });
    } catch (error) {
        res.status(500).json({ error: "Error obteniendo requisitos" });
    }
};

export const getCorrelatividadById = async (req, res) => {
    try {
        const { id } = req.params;
        const regla = await Correlatividad.findOne({ id: parseInt(id) }).lean();

        if (!regla) return res.status(404).json({ error: "Regla no encontrada" });

        const reglaPoblada = await poblarReglas([regla]);
        res.json({ message: `Detalle de la regla ID: ${id}`, data: reglaPoblada[0] });
    } catch (error) {
        res.status(500).json({ error: "Error obteniendo la regla" });
    }
};

export const createCorrelatividad = async (req, res) => {
    try {
        const datos = req.body;

        // Soporte para carga masiva (Insert Many)
        if (Array.isArray(datos)) {
            if (datos.length === 0) return res.status(400).json({ error: "La lista de reglas está vacía" });

            const materiasPorId = new Map((await Materia.find().lean()).map(m => [m.id, m]));
            const existentes = new Set((await Correlatividad.find().lean()).map(r => `${r.materia_id}-${r.requisito_id}`));
            const documentos = [];

            for (const [posicion, item] of datos.entries()) {
                const etiqueta = `Regla ${posicion + 1}`;
                if (!item || !esNumeroEntero(item.materia_id) || !esNumeroEntero(item.requisito_id) || !TIPOS_REQUISITO.includes(item.tipo_requisito)) {
                    return res.status(400).json({ error: `${etiqueta}: faltan datos o el tipo de requisito no es válido (Regular / Aprobada)` });
                }
                const materia_id = Number(item.materia_id);
                const requisito_id = Number(item.requisito_id);

                if (materia_id === requisito_id) {
                    return res.status(400).json({ error: `${etiqueta}: una materia no puede ser requisito de sí misma` });
                }
                const { error } = await validarMismoPlan(materia_id, requisito_id, materiasPorId);
                if (error) return res.status(400).json({ error: `${etiqueta}: ${error}` });

                const clave = `${materia_id}-${requisito_id}`;
                if (existentes.has(clave)) return res.status(400).json({ error: `${etiqueta}: esa correlatividad ya existe` });
                existentes.add(clave);

                documentos.push({
                    id: esNumeroEntero(item.id) ? Number(item.id) : null,
                    materia_id, requisito_id, tipo_requisito: item.tipo_requisito
                });
            }

            // Los IDs automáticos arrancan por encima del mayor ID de la base y del propio lote
            let proximoId = Math.max(await siguienteId(Correlatividad), ...documentos.map((d) => (d.id || 0) + 1));
            for (const doc of documentos) {
                if (doc.id === null) doc.id = proximoId++;
            }

            const nuevasReglas = await Correlatividad.insertMany(documentos);
            return res.status(201).json({ message: 'Reglas creadas masivamente', data: nuevasReglas });
        }

        // Carga individual (el ID es opcional: si no viene se asigna el siguiente libre)
        const { id, materia_id, requisito_id, tipo_requisito } = datos;

        if (!esNumeroEntero(materia_id) || !esNumeroEntero(requisito_id) || !tipo_requisito) {
            return res.status(400).json({ error: "Faltan datos obligatorios" });
        }
        if (!TIPOS_REQUISITO.includes(tipo_requisito)) {
            return res.status(400).json({ error: "El tipo de requisito debe ser Regular o Aprobada" });
        }
        if (Number(materia_id) === Number(requisito_id)) {
            return res.status(400).json({ error: "Una materia no puede ser requisito de sí misma" });
        }

        const { error } = await validarMismoPlan(materia_id, requisito_id);
        if (error) return res.status(400).json({ error });

        const repetida = await Correlatividad.findOne({ materia_id: Number(materia_id), requisito_id: Number(requisito_id) }).lean();
        if (repetida) return res.status(400).json({ error: "Esa correlatividad ya existe" });

        const nuevoId = esNumeroEntero(id) ? Number(id) : await siguienteId(Correlatividad);
        const nuevaRegla = await Correlatividad.create({ id: nuevoId, materia_id: Number(materia_id), requisito_id: Number(requisito_id), tipo_requisito });
        res.status(201).json({ message: 'Regla creada exitosamente', data: nuevaRegla });

    } catch (error) {
        if (error.code === 11000) return res.status(400).json({ error: "El ID de la regla ya existe" });
        res.status(500).json({ error: "Error al crear regla(s)" });
    }
};

export const updateCorrelatividad = async (req, res) => {
    try {
        const { id } = req.params;
        const { materia_id, requisito_id, tipo_requisito } = req.body;

        const actual = await Correlatividad.findOne({ id: parseInt(id) }).lean();
        if (!actual) return res.status(404).json({ error: "Regla no encontrada" });

        // Se valida el resultado FINAL (lo recibido mezclado con lo que ya tenía la regla)
        const finalMateria = esNumeroEntero(materia_id) ? Number(materia_id) : actual.materia_id;
        const finalRequisito = esNumeroEntero(requisito_id) ? Number(requisito_id) : actual.requisito_id;
        const finalTipo = tipo_requisito || actual.tipo_requisito;

        if (!TIPOS_REQUISITO.includes(finalTipo)) {
            return res.status(400).json({ error: "El tipo de requisito debe ser Regular o Aprobada" });
        }
        // Validación para evitar que la materia sea requisito de sí misma
        if (finalMateria === finalRequisito) {
            return res.status(400).json({ error: "Actualización inválida: Una materia no puede ser requisito de sí misma" });
        }

        const { error } = await validarMismoPlan(finalMateria, finalRequisito);
        if (error) return res.status(400).json({ error });

        const reglaActualizada = await Correlatividad.findOneAndUpdate(
            { id: parseInt(id) },
            { materia_id: finalMateria, requisito_id: finalRequisito, tipo_requisito: finalTipo },
            { new: true }
        );

        if (!reglaActualizada) return res.status(404).json({ error: "Regla no encontrada" });
        res.json({ message: "Regla actualizada", data: reglaActualizada });

    } catch (error) {
        res.status(500).json({ error: "Error al actualizar la regla" });
    }
};

export const deleteCorrelatividad = async (req, res) => {
    try {
        const { id } = req.params;
        const eliminada = await Correlatividad.findOneAndDelete({ id: parseInt(id) });

        if (!eliminada) return res.status(404).json({ error: "Regla no encontrada" });
        res.json({ message: "Regla eliminada", data: eliminada });
        
    } catch (error) {
        res.status(500).json({ error: "Error al eliminar la regla" });
    }
};

export default {
    getCorrelatividades,
    getRequisitosByMateria,
    getCorrelatividadById,
    createCorrelatividad,
    updateCorrelatividad,
    deleteCorrelatividad
};
