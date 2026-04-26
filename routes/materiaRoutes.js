const express = require('express');
const router = express.Router();
const materiaController = require('../controllers/materiaController');

// Rutas de API para Materias
router.get('/materias', materiaController.getMaterias);
router.get('/materias/:id', materiaController.getMateriaById);
router.post('/materias', materiaController.createMateria);
router.put('/materias/:id', materiaController.updateMateria);
router.delete('/materias/:id', materiaController.deleteMateria);

module.exports = router;