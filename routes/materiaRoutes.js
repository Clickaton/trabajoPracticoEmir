import express from 'express';
import * as materiaController from '../Controllers/materiaController.js';
import { requireLogin } from '../middlewares/authHybrid.js';

const router = express.Router();

// Proteger todas las rutas con middleware JWT
router.use(requireLogin);

// Rutas de API para Materias
router.get('/materias', materiaController.getMaterias);
router.get('/materias/:id', materiaController.getMateriaById);
router.post('/materias', materiaController.createMateria);
router.put('/materias/:id', materiaController.updateMateria);
router.delete('/materias/:id', materiaController.deleteMateria);

export default router;