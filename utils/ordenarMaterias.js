// Orden único para TODA lista de materias del sistema: primero por año (1º, 2º, 3º...) y, dentro de cada año, por nombre.
// Se usa en inscripciones, correlatividades, historial, estado académico, constancias, etc.

// Compara texto como se espera en español: ignora mayúsculas y tildes ("Álgebra" junto a "Algebra") y respeta la ñ.
const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

export const compararTexto = (a, b) => collator.compare(String(a ?? ''), String(b ?? ''));

const compararNumeros = (x, y) => (x === y ? 0 : x < y ? -1 : 1);

// Un año vacío o inválido va al final de su grupo
const numero = (valor) => (valor === null || valor === undefined || Number.isNaN(Number(valor)) ? Number.POSITIVE_INFINITY : Number(valor));

const ACCESORES_POR_DEFECTO = {
    grupo: () => 0,          // criterio previo opcional (ej. plan_id) para listas que mezclan planes
    anio: (x) => x.anio,
    nombre: (x) => x.nombre
};

// Comparador listo para Array.sort. Con `accesores` se adapta a objetos de otra forma,
// por ejemplo filas del historial: { anio: (f) => f.anio, nombre: (f) => f.materia }
export const compararMaterias = (a, b, accesores = {}) => {
    const { grupo, anio, nombre } = { ...ACCESORES_POR_DEFECTO, ...accesores };

    return compararNumeros(numero(grupo(a)), numero(grupo(b)))
        || compararNumeros(numero(anio(a)), numero(anio(b)))
        || compararTexto(nombre(a), nombre(b));
};

// Devuelve una copia ordenada (no modifica la lista original)
export const ordenarMaterias = (lista, accesores = {}) => [...lista].sort((a, b) => compararMaterias(a, b, accesores));
