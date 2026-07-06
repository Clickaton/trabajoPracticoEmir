import jwt from 'jsonwebtoken';

/**
 * Middleware JWT: Valida JWT desde Authorization header o cookie
 * Requerido para acceso autenticado
 */
export const requireLogin = (req, res, next) => {
    const token = extractToken(req);
    
    if (!token) {
        return res.redirect('/login');
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            console.log('[JWT] Token inválido o expirado');
            return res.redirect('/login');
        }
        
        req.user = decoded;
        next();
    });
};

/**
 * Middleware JWT con validación de rol
 * Valida que el usuario tenga el rol requerido
 */
export const requireRole = (role) => {
    return (req, res, next) => {
        const token = extractToken(req);
        
        if (!token) {
            return res.redirect('/login');
        }

        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) {
                return res.redirect('/login');
            }
            
            const user = decoded;
            const userRole = (user.rol || user.role || '').toString();

            if (userRole === role) {
                req.user = user;
                return next();
            }

            // Si es alumno autenticado, redirige al dashboard
            const tipoPerfil = (user.tipoPerfil || '').toString();
            if (tipoPerfil.toLowerCase() === 'alumno' || userRole.toLowerCase() === 'alumno') {
                return res.redirect('/dashboard');
            }

            return res.redirect('/login');
        });
    };
};

/**
 * Middleware JWT para APIs: Devuelve JSON en lugar de redirigir
 */
export const verifyToken = (req, res, next) => {
    const token = extractToken(req);

    if (!token) {
        return res.status(403).json({ error: "Acceso denegado. Se requiere un token." });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ error: "Token expirado. Por favor, inicie sesión de nuevo." });
            }
            return res.status(401).json({ error: "Token inválido o corrupto." });
        }
        
        req.user = decoded;
        next();
    });
};

/**
 * Middleware para verificar rol de Administrativo (APIs)
 * SIN USO ACTUALMENTE, pero puede ser útil para futuras rutas de API que requieran rol específico
 */
export const isAdmin = (req, res, next) => {
    if (req.user && (req.user.rol === 'Administrativo' || req.user.rol === 'Direccion')) {
        next();
    } else {
        res.status(403).json({ error: "Acceso denegado. Se requiere rol de Administrador." });
    }
};

/**
 * Función auxiliar para extraer token de Authorization header o cookie
 */
function extractToken(req) {
    // 1. Intenta obtener del header Authorization
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.split(' ')[1];
    }

    // 2. Intenta obtener de la cookie
    if (req.cookies?.jwtToken) {
        return req.cookies.jwtToken;
    }

    return null;
}

