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

            // Sin permiso para esta pantalla: se lo manda a la suya o, si no tiene ninguna, se le explica (ver responderSinPermiso)
            return responderSinPermiso(req, res, user);
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
 * Roles que pueden modificar datos académicos (cargar notas, períodos, historial, etc.).
 * Un Profesor puede consultar (ver isAdminRole) pero no modificar.
 */
export const ROLES_ADMINISTRATIVOS = Object.freeze(['Administrativo', 'Direccion', 'Secretario']);

/**
 * Pantalla de inicio de cada persona, o null si su rol no tiene ninguna pantalla en el sistema.
 * Es la ÚNICA fuente de verdad: la usan el login, el login con Google y requireRole. Así los tres mandan a cada
 * persona al mismo lugar y ninguno puede mandarla a una pantalla que después la rechace (eso era el bucle de redirecciones).
 *   Alumno                                  -> /dashboard
 *   Administrativo, Direccion, Secretario   -> /api/administrativos (panel)
 *   Profesor, Bibliotecario u otro rol      -> null: consultan datos por API, pero no tienen una pantalla propia
 */
export const rutaInicio = (user = {}) => {
    const rol = String(user?.rol ?? user?.role ?? '').trim();
    if (user?.tipoPerfil === 'Alumno' || rol === 'Alumno') return '/dashboard';
    if (ROLES_ADMINISTRATIVOS.includes(rol)) return '/api/administrativos';
    return null;
};

/** Página (403) que explica por qué no hay pantalla para este rol. Se muestra en lugar de redirigir en círculos. */
export const renderSinAcceso = (res, user = {}) => {
    const rol = String(user?.rol ?? user?.role ?? '').trim();
    return res.status(403).render('error', {
        statusCode: 403,
        title: 'Sin pantallas habilitadas',
        message: `Tu usuario${rol ? ` (rol: ${rol})` : ''} no tiene pantallas habilitadas en este sistema. Si necesitás acceso, pedíselo a Secretaría o a Dirección.`
    });
};

/**
 * Qué hacer con alguien que no puede ver la página que pidió:
 *  - si tiene una pantalla propia y no es esta, se lo manda ahí;
 *  - si no tiene pantalla, o ya está parado en ella, se le explica con un 403 (redirigir acá sería un bucle).
 */
const responderSinPermiso = (req, res, user) => {
    const inicio = rutaInicio(user);
    const rutaPedida = String(req.originalUrl || req.url || '').split('?')[0].replace(/\/+$/, '') || '/';
    if (inicio && rutaPedida !== inicio) return res.redirect(inicio);
    return renderSinAcceso(res, user);
};

/**
 * Middleware para APIs que modifican datos: debe ir DESPUÉS de verifyToken.
 * A diferencia de requireRole (que redirige a una pantalla HTML), responde JSON 403,
 * que es lo que espera un fetch() del navegador.
 */
export const requireAdminApi = (req, res, next) => {
    const rol = String(req.user?.rol ?? req.user?.role ?? '').trim();
    if (ROLES_ADMINISTRATIVOS.includes(rol)) return next();
    return res.status(403).json({ error: "Acceso denegado. Se requiere un rol administrativo." });
};

/**
 * Middleware para APIs de CONSULTA del personal del instituto (incluye Profesor, que consulta pero no modifica).
 * Debe ir DESPUÉS de verifyToken. Responde JSON 403 a un alumno u otro rol.
 */
export const requireStaffApi = (req, res, next) => {
    if (isAdminRole(req.user)) return next();
    return res.status(403).json({ error: "Acceso denegado. Esta información es solo para el personal del instituto." });
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

    // Antes se hacía next(string): Express respondía con una página HTML y el fetch() del navegador fallaba
    // con "Unexpected token '<', <!DOCTYPE..." (el mismo síntoma del bug de la inscripción).
    return res.status(403).json({ error: 'No autorizado: este recurso no pertenece al usuario autenticado' });
  };
};
