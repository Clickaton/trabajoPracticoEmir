import jwt from 'jsonwebtoken';

// Identifica a la persona en cada pedido a partir de la cookie `jwtToken`.
// No bloquea a nadie: si no hay sesión (o el token no sirve) deja `usuario` en null y sigue. Quién puede entrar
// adónde lo deciden después los guardias de authHybrid.js.
//   - res.locals.usuario y res.locals.jwtToken: los usan las vistas Pug (por ejemplo, el nombre en la barra superior)
//   - req.user: lo usan los controladores y los guardias
export const identificarUsuario = (req, res, next) => {
    const token = req.cookies?.jwtToken || null;

    res.locals.jwtToken = token;

    if (!token) {
        res.locals.usuario = null;
        return next();
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            res.locals.usuario = null;
            return next();
        }

        req.user = decoded;
        res.locals.usuario = decoded;
        next();
    });
};
