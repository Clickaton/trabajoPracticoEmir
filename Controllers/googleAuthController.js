import { google } from 'googleapis';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Configuración del cliente oficial de Google
export const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

// 1. Generar la URL y redirigir a la pantalla de Google
export const getGoogleAuthURL = (req, res) => {
    const scopes = [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/spreadsheets'
    ];

    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline', // Clave para obtener el refresh_token
        prompt: 'consent',      // Fuerza a que pregunte siempre
        scope: scopes
    });

    res.redirect(url);
};

// 2. Recibir los datos cuando Google nos devuelve al usuario
export const googleAuthCallback = async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.status(400).send("No se recibió el código de autorización de Google.");
    }

    try {
        // Intercambiamos el código por los tokens de acceso
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Pedimos los datos del perfil (email, nombre)
        const oauth2 = google.oauth2({ auth: oauth2Client, version: 'v2' });
        const { data } = await oauth2.userinfo.get();

        // VALIDACIÓN DE SEGURIDAD 1: El dominio debe ser del instituto
        if (!data.email.endsWith('@isft225.edu.ar')) {
            return res.status(403).send("Acceso denegado: Solo se permiten correos institucionales (@isft225.edu.ar).");
        }

        // VALIDACIÓN DE SEGURIDAD 2: El correo debe existir en nuestra base de MongoDB (colección usuarios)
        const usuario = await User.findOne({ email: data.email });

        if (!usuario) {
            return res.status(403).send("Acceso denegado: Tu correo es válido pero no estás registrado en el sistema por un administrador.");
        }

        // Si pasó las validaciones, armamos el JWT con los datos del usuario de la colección unificada
        const payload = {
            id: usuario.id,
            name: usuario.name,
            email: usuario.email,
            rol: usuario.rol || usuario.role,
            role: usuario.rol || usuario.role,
            tipoPerfil: usuario.tipoPerfil,
            area: usuario.area,
            googleTokens: tokens 
        };

        const jwtToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

        res.cookie('jwtToken', jwtToken, {
            httpOnly: true,
            secure: false, // En producción con HTTPS poner en true
            maxAge: 1000 * 60 * 60 * 2,
            sameSite: 'lax' // antes: 'strict'
        });

        // 🔍 CONSOLE.LOG DE DEPURACIÓN
        console.log("--- DATOS DEL USUARIO LOGUEADO CON GOOGLE ---");
        console.log("Nombre:", usuario.name);
        console.log("Email:", usuario.email);
        console.log("Rol:", usuario.rol);
        console.log("TipoPerfil:", usuario.tipoPerfil);
        console.log("----------------------------------------------");

        // Redirigimos según el tipo de perfil e idéntico al login tradicional
        if (usuario.tipoPerfil === 'Alumno') {
            return res.redirect('/dashboard');
        } else if (usuario.rol === 'Administrativo' || usuario.rol === 'Direccion' || usuario.tipoPerfil === 'Personal') {
            return res.redirect('/api/administrativos');
        } else {
            res.redirect('/getUsers');
        }

    } catch (error) {
        console.error('Error en el callback de Google:', error);
        res.status(500).send("Error interno al autenticar con Google.");
    }
};
