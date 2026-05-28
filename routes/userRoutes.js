import express from 'express';
import * as userController from '../Controllers/userController.js';

const router = express.Router();

// Rutas para renderizar vistas
router.get('/getUsers', userController.getUsers);
router.get('/registerUser', userController.getRegisterForm);
router.get('/editUser/:id', userController.getEditForm);

// Rutas de API
router.get('/getUserById/:id', userController.getUserById);
router.post('/createUser', userController.createUser);
router.post('/updateUser/:id', userController.updateUser);
router.post('/deleteUser/:id', userController.deleteUser);

// Rutas de login:
router.get('/login', userController.getLoginForm);
router.post('/login', userController.loginUser);
router.get('/register', userController.getRegisterForm);
router.post('/register', userController.createUser);

export default router;