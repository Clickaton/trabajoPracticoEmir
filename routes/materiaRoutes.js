import express from 'express';
import * as materiaController from '../Controllers/materiaController.js';

const router = express.Router();

// Rutas de API para Materias
router.get('/materias', materiaController.getMaterias);
router.get('/materias/:id', materiaController.getMateriaById);
router.post('/materias', materiaController.createMateria);
router.put('/materias/:id', materiaController.updateMateria);
router.delete('/materias/:id', materiaController.deleteMateria);

export default router;