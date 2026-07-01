import express from 'express';
import administrativoController from '../Controllers/administrativoController.js';
import { requireRole } from '../middlewares/authHybrid.js';

const router = express.Router();

// Rutas para renderizar vistas (Pantallas)
router.get('/', requireRole('Administrativo'), administrativoController.getAdministrativos);

// Rutas de procesamiento (Acciones de los formularios)
router.get('/:id', requireRole('Administrativo'), administrativoController.getAdministrativoById);
router.post('/', requireRole('Administrativo'), administrativoController.createAdministrativo);
router.post('/editar/:id', requireRole('Administrativo'), administrativoController.updateAdministrativo);
router.post('/eliminar/:id', requireRole('Administrativo'), administrativoController.deleteAdministrativo);

export default router;