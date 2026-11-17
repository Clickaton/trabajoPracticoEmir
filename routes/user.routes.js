import * as googleAuthController from '../Controllers/googleAuthController.js';
import express from 'express';
import * as userController from '../Controllers/userController.js';

const router = express.Router();

// --- Rutas Públicas ---
// La entrada principal del sistema lleva al formulario de autenticación.
router.get('/', (req, res) => {
    res.redirect('/login');
});
router.get('/login', (req, res) => {
    res.render('userLogin');
});

// --- Login con Google ---
router.get('/auth/google', googleAuthController.getGoogleAuthURL);
router.get('/auth/google/callback', googleAuthController.googleAuthCallback);

router.post('/login', userController.userLogin);
router.get('/logout', userController.logout);

export default router;
