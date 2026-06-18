export const requireLogin = (req, res, next) => {
    if (req.session && req.session.user) {
        return next(); // El usuario está autenticado, la petición continúa
    } else {
        return res.redirect('/login'); // No hay sesión, redirigir al login
    }
};

export const requireRole = (role) => {
    return (req, res, next) => {
        if (req.session && req.session.user.rol === role) {
            return next(); // El usuario tiene el rol requerido, la petición continúa
        } else {
            return res.status(403).send('Acceso no autorizado'); // El usuario no tiene el rol requerido
        }
    };
};