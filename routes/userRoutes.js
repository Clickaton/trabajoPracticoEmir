import * as googleAuthController from '../Controllers/googleAuthController.js';
import express from 'express';
import * as userController from '../Controllers/userController.js';
import { requireLogin, requireRole, requireOwnershipOrAdmin } from '../middlewares/authHybrid.js';

const router = express.Router();
const rolesPermitidos = ['Administrativo', 'Direccion', 'Secretario', 'Profesor'];

// --- Rutas Públicas ---
router.get('/login', (req, res) => {
    res.render('userLogin');
});
// --- Rutas de Login con Google ---
router.get('/auth/google', googleAuthController.getGoogleAuthURL);
router.get('/auth/google/callback', googleAuthController.googleAuthCallback);

router.post('/login', userController.userLogin);
router.post('/createUser', requireLogin, requireRole(rolesPermitidos), userController.createUser);
router.get('/logout', userController.logout);

// --- Rutas Protegidas ---
router.get('/getUsers', requireRole(rolesPermitidos), requireLogin, userController.getUsers);
router.get('/editUser/:id', requireOwnershipOrAdmin('id'), requireLogin, userController.getEditForm);
router.get('/getUserById/:id', requireOwnershipOrAdmin('id'), requireLogin, userController.getUserById);
router.post('/updateUser/:id', requireOwnershipOrAdmin('id'), requireLogin, requireRole(rolesPermitidos), userController.updateUser);
router.post('/deleteUser/:id', requireOwnershipOrAdmin('id'), requireLogin, requireRole(rolesPermitidos), userController.deleteUser);

export default router;