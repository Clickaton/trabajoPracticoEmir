import User from '../models/User.js';

// Reglas compartidas por todas las pantallas que editan datos de una cuenta (alumnos, personal y usuarios).

// Una contraseña "vacía" (campo en blanco o solo espacios) significa "no cambiarla": se conserva la actual.
// Devuelve la contraseña nueva tal cual la escribió la persona, o null si no hay que cambiarla.
export const contraseniaNueva = (valor) => (typeof valor === 'string' && valor.trim() !== '' ? valor : null);

export const normalizarEmail = (valor) => (typeof valor === 'string' ? valor.trim() : '');

export const emailValido = (valor) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);

const escaparRegex = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ¿Otra cuenta (de alumno o de personal) ya usa este email? El ingreso al sistema busca por email,
// así que si dos cuentas lo comparten una puede dejar sin acceso a la otra.
// `idExcluido` es la propia cuenta que se está editando. `Modelo` se puede reemplazar en las pruebas.
export const emailEnUso = async (email, idExcluido = null, Modelo = User) => {
    if (!email) return false;
    const filtro = { email: new RegExp(`^${escaparRegex(email)}$`, 'i') };
    if (idExcluido !== null && idExcluido !== undefined && !Number.isNaN(Number(idExcluido))) {
        filtro.id = { $ne: Number(idExcluido) };
    }
    return Boolean(await Modelo.exists(filtro));
};

// Campos que un alumno puede cambiar de su propio perfil. El resto (DNI, legajo, estado activo,
// fecha de inscripción, cohorte, tipo de ingreso y pase) los carga solamente el personal administrativo.
export const CAMPOS_PERFIL_ALUMNO = Object.freeze(['name', 'email', 'password']);
export const CAMPOS_SOLO_PERSONAL = Object.freeze(['dni', 'legajo', 'activo', 'fecha_inscripcion', 'cohorte_id']);
