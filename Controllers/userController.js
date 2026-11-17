import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import { rutaInicio, renderSinAcceso, rolDeSesion } from '../middlewares/authHybrid.js';

// Logeo del usuario

export const userLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const usuario = await User.findOne({ email });
        
        if (!usuario) {
            return res.status(401).render('userLogin', { error: 'Credenciales inválidas' });
        }

        const passwordValida = await usuario.comparePassword(password);
        if (!passwordValida) {
            return res.status(401).render('userLogin', { error: 'Credenciales inválidas' });
        }


        // Crear payload con datos del usuario. El rol sale de rolDeSesion: el alumno no tiene campo `rol` (solo tipoPerfil)
        const payload = {
            id: usuario.id,
            name: usuario.name,
            email: usuario.email,
            rol: rolDeSesion(usuario),
            tipoPerfil: usuario.tipoPerfil,
            area: usuario.area,
            legajo: usuario.legajo,
            activo: usuario.activo,
            fecha_inscripcion: usuario.fecha_inscripcion
        };

        // Firmar token JWT con expiración de 8 horas
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

        // Guardar token en cookie httpOnly
        res.cookie('jwtToken', token, {
            httpOnly: true,
            secure: false,      // true en producción (HTTPS)
            maxAge: 1000 * 60 * 60 * 2,
            sameSite: 'lax' // antes: 'strict'
        });
        
        // Cada perfil entra por su pantalla; si su rol no tiene ninguna (Profesor, Bibliotecario) se le explica
        const destino = rutaInicio(payload);
        if (!destino) return renderSinAcceso(res, payload);
        return res.redirect(destino);

    } catch (error) {
        res.status(500).send("Error interno del servidor");
    }
};

export const logout = (req, res) => {
    // Limpiar cookies
    res.clearCookie('jwtToken');
    res.redirect('/login');
};