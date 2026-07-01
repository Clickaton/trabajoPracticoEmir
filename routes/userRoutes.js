import express from 'express';
import * as userController from '../Controllers/userController.js';
import { requireLogin } from '../middlewares/authHybrid.js';

const router = express.Router();

// --- Rutas Públicas ---
router.get('/login', (req, res) => {
    res.render('userLogin');
});
router.post('/login', userController.userLogin);
router.post('/createUser', userController.createUser);
router.get('/logout', userController.logout);

// --- Rutas Protegidas ---
router.get('/getUsers', requireLogin, userController.getUsers);
router.get('/editUser/:id', requireLogin, userController.getEditForm);
router.get('/getUserById/:id', requireLogin, userController.getUserById);
router.post('/updateUser/:id', requireLogin, userController.updateUser);
router.post('/deleteUser/:id', requireLogin, userController.deleteUser);

export default router;