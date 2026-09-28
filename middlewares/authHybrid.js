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
 * Valida que el usuario tenga el rol (o uno de los roles) requerido
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

            // 1. Normalizamos: si "role" es un string, lo convertimos a array. Si ya es array, lo dejamos igual.
            const allowedRoles = Array.isArray(role) ? role : [role];

            // 2. Verificamos si el rol del usuario está incluido en los permitidos
            if (allowedRoles.includes(userRole)) {
                req.user = user;
                return next();
            }

            if (userRole === 'Alumno') {
                return res.redirect('/dashboard');
            }

            if (userRole === 'Administrativo' 
                || userRole === 'Direccion' 
                || user.tipoPerfil === 'Personal'
                || userRole === 'Secretario'
                || userRole === 'Profesor') {
                return res.redirect('/api/administrativos');
            }
            
            // Si es otro tipo de usuario sin permisos
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

/**
    * Función para verificar si el usuario tiene rol de Administrador
 */
export const isAdminRole = (user = {}) => {
  const role = String(user?.rol ?? user?.role ?? user?.tipoPerfil ?? '')
    .trim()
    .toLowerCase();

  return ['administrativo', 'direccion', 'secretario', 'profesor'].includes(role);
};


/**
 * 
Middleware para verificar si el usuario autenticado es dueño del recurso o tiene rol de Administrador
 */
export const requireOwnershipOrAdmin = (paramName, options = {}) => {
  const {
    source = 'params', // 'params' | 'body' | 'query'
    allowAdmin = true,
    idField = 'id'
  } = options;

  return (req, res, next) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const currentUserId = user[idField] ?? user.userId ?? user.alumnoId ?? user.id;
    const targetValue =
      source === 'body'
        ? req.body?.[paramName]
        : source === 'query'
          ? req.query?.[paramName]
          : req.params?.[paramName];

    if (allowAdmin && isAdminRole(user)) {
      return next();
    }

    if (targetValue === undefined || targetValue === null || targetValue === '') {
      return res.status(400).json({ error: 'Falta el identificador del recurso' });
    }

    if (String(currentUserId) === String(targetValue)) {
      return next();
    }

    res.status(403);
    res.error = 'No autorizado: este recurso no pertenece al usuario autenticado';
    return next(res.error);
  };
};
