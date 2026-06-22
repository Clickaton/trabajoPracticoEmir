export const requireLogin = (req, res, next) => {
    if (req.session && req.session.user) {
        return next(); // El usuario está autenticado, la petición continúa
    } else {
        return res.redirect('/login'); // No hay sesión, redirigir al login
    }
};

export const requireRole = (role) => {
    return (req, res, next) => {
        // No autenticado -> login
        if (!req.session || !req.session.user) {
            return res.redirect('/login');
        }

        const user = req.session.user;
        const userRole = (user.rol || user.role || '').toString();

        if (userRole === role) {
            return next(); // El usuario tiene el rol requerido, la petición continúa
        }

        // Si es un alumno autenticado, redirigimos silenciosamente al dashboard
        const tipoPerfil = (user.tipoPerfil || '').toString();
        if (tipoPerfil.toLowerCase() === 'alumno' || userRole.toLowerCase() === 'alumno') {
            return res.redirect('/dashboard');
        }

        // Para cualquier otro caso, devolvemos 403
        return res.status(403).send('Acceso no autorizado'); // El usuario no tiene el rol requerido
    };
};