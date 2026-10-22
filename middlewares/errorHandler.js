// Manejo global de errores.
//  - Si quien llama es un fetch() del navegador (o cualquier cliente que no pide una página), la respuesta es JSON:
//    { error: "mensaje", status: 400 }. Antes llegaba una página HTML y el navegador fallaba con
//    "Unexpected token '<', <!DOCTYPE...".
//  - Si es una navegación del navegador (el usuario escribe una dirección o abre un enlace), se muestra la página
//    de error del instituto.
// Los errores inesperados (500) se registran en la consola del servidor y nunca muestran detalles internos.

const TITULOS = {
    400: 'Solicitud inválida',
    401: 'Sesión no iniciada',
    403: 'Acceso denegado',
    404: 'Ubicación no disponible',
    409: 'Conflicto con los datos existentes',
    413: 'Solicitud demasiado grande'
};

const MENSAJE_500 = 'Error interno del sistema. Si el problema se repite, avisá a sistemas.';

// Convierte cualquier error (propio, de Mongoose o de Express) en { status, mensaje } apto para mostrar.
export const describirError = (error) => {
    if (error?.name === 'ValidationError' && error.errors) {
        const detalles = Object.values(error.errors).map((e) => e.message).filter(Boolean);
        return { status: 400, mensaje: detalles.length ? detalles.join('. ') : 'Hay datos que no son válidos' };
    }
    if (error?.name === 'CastError') {
        return { status: 400, mensaje: `El valor indicado para "${error.path ?? 'un campo'}" no es válido` };
    }
    if (error?.code === 11000) {
        const campos = Object.keys(error.keyValue ?? {});
        return { status: 409, mensaje: campos.length ? `Ya existe un registro con ese valor (${campos.join(', ')})` : 'Ya existe un registro con esos datos' };
    }
    if (error?.type === 'entity.parse.failed') {
        return { status: 400, mensaje: 'El cuerpo de la solicitud no es un JSON válido' };
    }
    if (error?.type === 'entity.too.large') {
        return { status: 413, mensaje: TITULOS[413] };
    }

    const status = Number(error?.status ?? error?.statusCode);
    if (Number.isInteger(status) && status >= 400 && status < 500) {
        return { status, mensaje: error.message || TITULOS[status] || 'No se pudo completar la solicitud' };
    }

    return { status: 500, mensaje: MENSAJE_500 };
};

// true si el cliente espera datos y no una página: fetch() (Accept: */* o application/json), axios, curl...
// El navegador, cuando navega, pide text/html primero.
export const prefiereJson = (req) => req.accepts(['json', 'html']) !== 'html';

// 404: ninguna ruta respondió
export const rutaNoEncontrada = (req, res, next) => {
    const error = new Error('Ubicación no disponible');
    error.status = 404;
    next(error);
};

// Express reconoce un manejador de errores por tener 4 parámetros: no quitar `next` aunque no se use
export const manejadorDeErrores = (error, req, res, next) => {
    if (res.headersSent) return next(error);

    const { status, mensaje } = describirError(error);
    if (status >= 500) console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, error);

    if (prefiereJson(req)) {
        return res.status(status).json({ error: mensaje, status });
    }

    return res.status(status).render('error', {
        statusCode: status,
        title: TITULOS[status] || (status >= 500 ? 'Error interno del sistema' : 'No se pudo completar la solicitud'),
        message: mensaje
    });
};
