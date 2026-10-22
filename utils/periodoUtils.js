// Reglas comunes de los períodos de inscripción (cursada y finales).
import { parseLocalDateTime } from './dateUtils.js';

export const TIPOS_PERIODO = Object.freeze(['Cursada', 'Final']);

// Los períodos creados antes de existir el tipo no lo tienen guardado: eran de cursada.
export const tipoDePeriodo = (periodo) => periodo?.tipo ?? 'Cursada';

// Un período está abierto si el administrador lo dejó activo Y el reloj del servidor está entre su inicio y su fin.
export const periodoVigente = (periodo, ahora = new Date()) => {
    if (!periodo?.activo) return false;

    const inicio = parseLocalDateTime(periodo.fechaInicio, periodo.horaInicio);
    const fin = parseLocalDateTime(periodo.fechaFin, periodo.horaFin);

    return Boolean(inicio && fin && ahora >= inicio && ahora <= fin);
};
