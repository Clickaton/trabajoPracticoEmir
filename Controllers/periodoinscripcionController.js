import PeriodoInscripcion from '../models/PeriodoInscripcion.js';
import Inscripcion from '../models/Inscripcion.js';
import InscripcionFinal from '../models/InscripcionFinal.js';
import { parseLocalDate } from '../utils/dateUtils.js';
import { TIPOS_PERIODO, tipoDePeriodo, periodoVigente } from '../utils/periodoUtils.js';
import { siguienteId } from '../utils/siguienteId.js';

const HORA = /^([01]?\d|2[0-3]):[0-5]\d$/;

const aBooleano = (valor) => valor === true || ['true', 'on', '1', 'yes'].includes(String(valor).toLowerCase());

// Valida y normaliza los datos de UN período (alta). Devuelve { datos } o { error }.
// Los períodos son de 'Cursada' (inscripción a materias) o 'Final' (inscripción a mesas de examen).
const validarPeriodo = (entrada) => {
    const { nombre, fechaInicio, fechaFin, horaInicio, horaFin, activo, tipo = 'Cursada', fechaExamen } = entrada || {};

    if (!nombre || !fechaInicio || !fechaFin || !horaInicio || !horaFin) {
        return { error: "Faltan datos obligatorios" };
    }
    if (!TIPOS_PERIODO.includes(tipo)) {
        return { error: `El tipo de período debe ser ${TIPOS_PERIODO.join(' o ')}` };
    }
    if (!HORA.test(String(horaInicio)) || !HORA.test(String(horaFin))) {
        return { error: "Las horas deben tener el formato HH:mm" };
    }

    const inicio = parseLocalDate(fechaInicio);
    const fin = parseLocalDate(fechaFin);
    if (!inicio || !fin) return { error: "Alguna de las fechas no es válida" };
    if (fin < inicio) return { error: "La fecha de fin no puede ser anterior a la de inicio" };

    let examen = null;
    if (tipo === 'Final' && fechaExamen) {
        examen = parseLocalDate(fechaExamen);
        if (!examen) return { error: "La fecha de examen no es válida" };
    }

    return {
        datos: {
            nombre: String(nombre).trim(),
            fechaInicio: inicio,
            fechaFin: fin,
            horaInicio,
            horaFin,
            activo: activo !== undefined ? aBooleano(activo) : false,
            tipo,
            fechaExamen: examen
        }
    };
};

const filtrarPorTipo = (lista, tipo) => (tipo ? lista.filter(p => tipoDePeriodo(p) === tipo) : lista);

// Valida el ?tipo= opcional de las consultas. Devuelve { tipo } (puede ser undefined) o { error }.
const leerTipoDeConsulta = (query) => {
    if (query.tipo === undefined || query.tipo === '') return { tipo: undefined };
    if (!TIPOS_PERIODO.includes(query.tipo)) return { error: `El tipo debe ser ${TIPOS_PERIODO.join(' o ')}` };
    return { tipo: query.tipo };
};

// Obtener todos los períodos (Para el panel del Admin). Opcional: ?tipo=Cursada | ?tipo=Final
export const getPeriodos = async (req, res) => {
    try {
        const { tipo, error } = leerTipoDeConsulta(req.query);
        if (error) return res.status(400).json({ error });

        const lista = await PeriodoInscripcion.find().lean();
        res.json({ message: 'Lista histórica de períodos de inscripción', data: filtrarPorTipo(lista, tipo) });
    } catch (error) {
        res.status(500).json({ error: "Error al obtener los períodos de inscripción" });
    }
};

// Obtener SOLO los períodos activos y que estén vigentes en fecha y hora. Opcional: ?tipo=Cursada | ?tipo=Final
export const getPeriodosActivos = async (req, res) => {
    try {
        const { tipo, error } = leerTipoDeConsulta(req.query);
        if (error) return res.status(400).json({ error });

        const ahora = new Date();

        // 1. Buscamos los que el Admin dejó marcados como activos en la BD
        const periodosBBDD = await PeriodoInscripcion.find({ activo: true }).lean();

        // 2. Filtramos dinámicamente comparando con el reloj del servidor
        const periodosVigentes = filtrarPorTipo(periodosBBDD, tipo).filter(p => periodoVigente(p, ahora));

        if (periodosVigentes.length === 0) {
            return res.json({ message: 'Inscripciones cerradas (no hay períodos vigentes en esta fecha)', data: [] });
        }

        res.json({ message: 'Períodos de inscripción abiertos actualmente', data: periodosVigentes });
    } catch (error) {
        res.status(500).json({ error: "Error al verificar períodos activos" });
    }
};

// Obtener un período por ID
export const getPeriodoById = async (req, res) => {
    try {
        const { id } = req.params;
        const periodo = await PeriodoInscripcion.findOne({ id: parseInt(id) }).lean();

        if (!periodo) return res.status(404).json({ error: "Período de inscripción no encontrado" });

        res.json({ message: `Detalles del período ID: ${id}`, data: periodo });
    } catch (error) {
        res.status(500).json({ error: "Error al obtener el período de inscripción" });
    }
};

// Crear un nuevo período (Soporta individual o masivo). El ID es opcional: si no viene se asigna el siguiente libre.
export const createPeriodo = async (req, res) => {
    try {
        const datos = req.body;

        // Soporte para carga masiva
        if (Array.isArray(datos)) {
            if (datos.length === 0) return res.status(400).json({ error: "La lista de períodos está vacía" });

            const documentos = [];
            for (const [posicion, item] of datos.entries()) {
                const { datos: normalizado, error } = validarPeriodo(item);
                if (error) return res.status(400).json({ error: `Período ${posicion + 1}: ${error}` });

                const idManual = item.id !== undefined && item.id !== null && item.id !== '' ? parseInt(item.id, 10) : null;
                if (idManual !== null && Number.isNaN(idManual)) return res.status(400).json({ error: `Período ${posicion + 1}: el ID no es válido` });
                documentos.push({ ...normalizado, id: idManual });
            }

            let proximoId = Math.max(await siguienteId(PeriodoInscripcion), ...documentos.map(d => (d.id || 0) + 1));
            for (const doc of documentos) {
                if (doc.id === null) doc.id = proximoId++;
            }

            const nuevosPeriodos = await PeriodoInscripcion.insertMany(documentos);
            return res.status(201).json({ message: 'Períodos creados masivamente', data: nuevosPeriodos });
        }

        // Carga individual
        const { datos: normalizado, error } = validarPeriodo(datos);
        if (error) return res.status(400).json({ error });

        const idManual = datos.id !== undefined && datos.id !== null && datos.id !== '' ? parseInt(datos.id, 10) : null;
        if (idManual !== null && (Number.isNaN(idManual) || idManual < 1)) return res.status(400).json({ error: "El ID del período no es válido" });

        const nuevoPeriodo = await PeriodoInscripcion.create({ ...normalizado, id: idManual ?? await siguienteId(PeriodoInscripcion) });

        res.status(201).json({ message: 'Período creado exitosamente', data: nuevoPeriodo });
    } catch (error) {
        if (error.code === 11000) return res.status(400).json({ error: "El ID del período ya existe" });
        res.status(500).json({ error: "Error al crear el período de inscripción" });
    }
};

// Actualizar un período (Acá el Admin prende o apaga las inscripciones)
export const updatePeriodo = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, fechaInicio, fechaFin, horaInicio, horaFin, activo, tipo, fechaExamen } = req.body;

        const actual = await PeriodoInscripcion.findOne({ id: parseInt(id) }).lean();
        if (!actual) return res.status(404).json({ error: "Período no encontrado" });

        const datosAActualizar = {};
        if (nombre) datosAActualizar.nombre = String(nombre).trim();
        if (fechaInicio) {
            datosAActualizar.fechaInicio = parseLocalDate(fechaInicio);
            if (!datosAActualizar.fechaInicio) return res.status(400).json({ error: "La fecha de inicio no es válida" });
        }
        if (fechaFin) {
            datosAActualizar.fechaFin = parseLocalDate(fechaFin);
            if (!datosAActualizar.fechaFin) return res.status(400).json({ error: "La fecha de fin no es válida" });
        }
        if (horaInicio || horaFin) {
            if ((horaInicio && !HORA.test(String(horaInicio))) || (horaFin && !HORA.test(String(horaFin)))) {
                return res.status(400).json({ error: "Las horas deben tener el formato HH:mm" });
            }
            if (horaInicio) datosAActualizar.horaInicio = horaInicio;
            if (horaFin) datosAActualizar.horaFin = horaFin;
        }
        if (activo !== undefined) datosAActualizar.activo = aBooleano(activo);

        // Se compara el resultado FINAL (lo recibido mezclado con lo guardado)
        const inicioFinal = datosAActualizar.fechaInicio ?? parseLocalDate(actual.fechaInicio);
        const finFinal = datosAActualizar.fechaFin ?? parseLocalDate(actual.fechaFin);
        if (inicioFinal && finFinal && finFinal < inicioFinal) {
            return res.status(400).json({ error: "La fecha de fin no puede ser anterior a la de inicio" });
        }

        // Tipo: no se puede cambiar un período que ya tiene inscripciones, porque quedarían del tipo equivocado
        const tipoFinal = tipo !== undefined && tipo !== '' ? tipo : tipoDePeriodo(actual);
        if (!TIPOS_PERIODO.includes(tipoFinal)) {
            return res.status(400).json({ error: `El tipo de período debe ser ${TIPOS_PERIODO.join(' o ')}` });
        }
        if (tipoFinal !== tipoDePeriodo(actual)) {
            const conCursadas = await Inscripcion.exists({ periodo_id: actual.id });
            const conFinales = await InscripcionFinal.exists({ periodo_id: actual.id });
            if (conCursadas || conFinales) {
                return res.status(409).json({ error: "No se puede cambiar el tipo de un período que ya tiene inscripciones. Creá un período nuevo." });
            }
            datosAActualizar.tipo = tipoFinal;
        }

        // La fecha de examen solo existe en los períodos de Final
        if (tipoFinal === 'Final') {
            if (fechaExamen !== undefined) {
                if (fechaExamen === '' || fechaExamen === null) {
                    datosAActualizar.fechaExamen = null;
                } else {
                    datosAActualizar.fechaExamen = parseLocalDate(fechaExamen);
                    if (!datosAActualizar.fechaExamen) return res.status(400).json({ error: "La fecha de examen no es válida" });
                }
            }
        } else {
            datosAActualizar.fechaExamen = null;
        }

        const periodoActualizado = await PeriodoInscripcion.findOneAndUpdate(
            { id: parseInt(id) },
            datosAActualizar,
            { new: true }
        );

        if (!periodoActualizado) return res.status(404).json({ error: "Período no encontrado" });
        res.json({ message: "Período actualizado", data: periodoActualizado });
    } catch (error) {
        res.status(500).json({ error: "Error al actualizar el período" });
    }
};

// Eliminar un período
export const deletePeriodo = async (req, res) => {
    try {
        const { id } = req.params;
        const eliminado = await PeriodoInscripcion.findOneAndDelete({ id: parseInt(id) });

        if (!eliminado) return res.status(404).json({ error: "Período no encontrado" });
        res.json({ message: "Período eliminado", data: eliminado });
    } catch (error) {
        res.status(500).json({ error: "Error al eliminar el período" });
    }
};

export default {
    getPeriodos,
    getPeriodosActivos,
    getPeriodoById,
    createPeriodo,
    updatePeriodo,
    deletePeriodo
};
