// Datos de ingreso del alumno (puntos 8 y 10): con qué situación entró a la carrera y si viene por pase de otro instituto.
// Son datos informativos: no cambian las reglas de cursada, correlatividades ni regularidad.
// Funciones puras (sin base de datos) para poder probarlas con tests simples.
import { parseLocalDate } from './dateUtils.js';

export const TIPOS_INGRESO = Object.freeze(['Inicial', 'Ingreso a 2do', 'Ingreso a 3ro']);

export const PASE_VACIO = Object.freeze({ esPase: false, institutoOrigen: '', fechaPase: null, observaciones: '' });

const vacio = (valor) => valor === undefined || valor === null || String(valor).trim() === '';
const aBooleano = (valor) => valor === true || valor === 1 || ['true', '1', 'on', 'si', 'sí'].includes(String(valor).trim().toLowerCase());

// Los formularios mandan los datos del pase "planos" (esPase, institutoOrigen, fechaPase, observacionesPase);
// una llamada JSON puede mandarlos agrupados en `pase: { esPase, institutoOrigen, fechaPase, observaciones }`.
const CAMPOS_DE_INGRESO = ['tipoIngreso', 'pase', 'esPase', 'institutoOrigen', 'fechaPase', 'observacionesPase'];

// ¿La petición trae algún dato de ingreso? (sirve para decidir permisos y si hay algo que validar)
export const traeDatosDeIngreso = (cuerpo = {}) => CAMPOS_DE_INGRESO.some(campo => cuerpo[campo] !== undefined);

// Valida y normaliza los datos de ingreso. Devuelve { datos } (solo con lo que vino en la petición) o { error }.
//   tipoIngreso: Inicial | Ingreso a 2do | Ingreso a 3ro (si viene vacío se ignora: al crear rige 'Inicial')
//   pase:        si es pase, el instituto de origen es obligatorio; la fecha (opcional) no puede ser futura.
//                Si no es pase, se limpian los demás datos del pase.
//   actual:      el alumno ya guardado; permite corregir un solo dato del pase sin reenviar los otros
export const validarDatosIngreso = (cuerpo = {}, { actual = null, ahora = new Date() } = {}) => {
    const datos = {};

    if (!vacio(cuerpo.tipoIngreso)) {
        const tipo = String(cuerpo.tipoIngreso).trim();
        if (!TIPOS_INGRESO.includes(tipo)) {
            return { error: `El tipo de ingreso debe ser uno de: ${TIPOS_INGRESO.join(', ')}` };
        }
        datos.tipoIngreso = tipo;
    }

    if (cuerpo.pase !== undefined && cuerpo.pase !== null && typeof cuerpo.pase !== 'object') {
        return { error: 'El pase debe enviarse como un objeto { esPase, institutoOrigen, fechaPase, observaciones }' };
    }
    if (cuerpo.pase === null) {
        datos.pase = { ...PASE_VACIO };
        return { datos };
    }

    const anidado = cuerpo.pase ?? {};
    const entrada = {
        esPase: anidado.esPase !== undefined ? anidado.esPase : cuerpo.esPase,
        institutoOrigen: anidado.institutoOrigen !== undefined ? anidado.institutoOrigen : cuerpo.institutoOrigen,
        fechaPase: anidado.fechaPase !== undefined ? anidado.fechaPase : cuerpo.fechaPase,
        observaciones: anidado.observaciones !== undefined ? anidado.observaciones : cuerpo.observacionesPase
    };
    if (Object.values(entrada).every(valor => valor === undefined)) return { datos };

    const base = { ...PASE_VACIO, ...(actual?.pase ?? {}) };

    // Un formulario con la casilla sin tildar no manda esPase: si cargaron un instituto, se entiende que es pase
    const esPase = entrada.esPase !== undefined
        ? aBooleano(entrada.esPase)
        : (!vacio(entrada.institutoOrigen) ? true : base.esPase === true);

    if (!esPase) {
        datos.pase = { ...PASE_VACIO };
        return { datos };
    }

    const institutoOrigen = entrada.institutoOrigen !== undefined ? String(entrada.institutoOrigen ?? '').trim() : (base.institutoOrigen || '');
    if (!institutoOrigen) {
        return { error: 'Si el alumno viene por pase, indicá el instituto de origen' };
    }

    let fechaPase = null;
    const fechaIndicada = entrada.fechaPase !== undefined ? entrada.fechaPase : base.fechaPase;
    if (!vacio(fechaIndicada)) {
        // Un Date ya viene de la base: se respeta tal cual; un texto del formulario se interpreta como fecha local
        fechaPase = fechaIndicada instanceof Date ? fechaIndicada : parseLocalDate(fechaIndicada);
        if (!fechaPase || Number.isNaN(fechaPase.getTime())) return { error: 'La fecha del pase no es válida' };
        const finDeHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59, 999);
        if (fechaPase > finDeHoy) return { error: 'La fecha del pase no puede ser futura' };
    }

    const observaciones = entrada.observaciones !== undefined ? String(entrada.observaciones ?? '').trim() : (base.observaciones || '');

    datos.pase = { esPase: true, institutoOrigen, fechaPase, observaciones };
    return { datos };
};
