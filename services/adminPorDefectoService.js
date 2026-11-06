import Administrativo from '../models/Administrativo.js';

// Cuenta con la que se entra la primera vez. Está documentada en el README (sección "Acceso para evaluadores").
export const ADMIN_POR_DEFECTO = Object.freeze({
    name: 'Administrador',
    email: 'admin@admin.com',
    password: 'admin123',
    rol: 'Administrativo',
    area: 'Sistema'
});

// Crea el administrador por defecto si todavía no existe. Devuelve true si lo creó.
// Si falla NO frena el servidor (se registra el error): el sistema puede seguir con los usuarios que ya están cargados.
// `modelo` se puede reemplazar en las pruebas para no necesitar una base de datos.
export const asegurarAdministradorPorDefecto = async (modelo = Administrativo) => {
    try {
        const existente = await modelo.findOne({ email: ADMIN_POR_DEFECTO.email });
        if (existente) return false;

        await modelo.create({ ...ADMIN_POR_DEFECTO });
        console.log('Usuario administrador por defecto creado.');
        return true;
    } catch (error) {
        console.error('Error asegurando el usuario administrador por defecto:', error);
        return false;
    }
};
