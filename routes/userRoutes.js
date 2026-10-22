import * as googleAuthController from '../Controllers/googleAuthController.js';
import express from 'express';
import * as userController from '../Controllers/userController.js';
import { requireLogin, requireRole, requireOwnershipOrAdmin, ROLES_ADMINISTRATIVOS } from '../middlewares/authHybrid.js';

const router = express.Router();
// Alta, edición y baja de cuentas: solo el personal administrativo (un Profesor consulta pero no modifica,
// y podía cambiarle la contraseña a cualquier usuario, incluido el administrador).
const rolesPermitidos = ROLES_ADMINISTRATIVOS;

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
router.get('/editUser/:id', requireLogin, requireRole(rolesPermitidos), userController.getEditForm);
router.get('/getUserById/:id', requireOwnershipOrAdmin('id'), requireLogin, userController.getUserById);
router.post('/updateUser/:id', requireLogin, requireRole(rolesPermitidos), userController.updateUser);
router.post('/deleteUser/:id', requireLogin, requireRole(rolesPermitidos), userController.deleteUser);

export default router;