const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Rutas para renderizar vistas
router.get('/getUsers', userController.getUsers);
router.get('/registerUser', userController.getRegisterForm);
router.get('/editUser/:id', userController.getEditForm);

// Rutas de API
router.get('/getUserById/:id', userController.getUserById);
router.post('/createUser', userController.createUser);
router.post('/updateUser/:id', userController.updateUser);
router.post('/deleteUser/:id', userController.deleteUser);

module.exports = router;