import express from 'express';
import * as materiaController from '../Controllers/materiaController.js';
import { requireLogin, requireRole } from '../middlewares/authHybrid.js';

const router = express.Router();
const rolesPermitidos = ['Administrativo', 'Direccion', 'Secretario'];

// Proteger todas las rutas con middleware JWT
router.use(requireLogin);

// Rutas de API para Materias
router.get('/materias', materiaController.getMaterias);
router.get('/materias/:id', materiaController.getMateriaById);
router.post('/materias', requireRole(rolesPermitidos), materiaController.createMateria);
router.put('/materias/:id', requireRole(rolesPermitidos), materiaController.updateMateria);
router.delete('/materias/:id', requireRole(rolesPermitidos), materiaController.deleteMateria);

export default router;