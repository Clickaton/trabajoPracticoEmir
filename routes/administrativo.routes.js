import express from 'express';
import administrativoController from '../Controllers/administrativoController.js';

const router = express.Router();

// Rutas para renderizar vistas (Pantallas)
router.get('/', administrativoController.getAdministrativos);           // URL final: /api/administrativos
router.get('/nuevo', administrativoController.getRegisterForm);         // URL final: /api/administrativos/nuevo
router.get('/editar/:id', administrativoController.getEditForm);        // URL final: /api/administrativos/editar/1

// Rutas de procesamiento (Acciones de los formularios)
router.get('/:id', administrativoController.getAdministrativoById);     // URL final: /api/administrativos/1
router.post('/', administrativoController.createAdministrativo);        // URL final: /api/administrativos
router.post('/editar/:id', administrativoController.updateAdministrativo);  // URL final: /api/administrativos/editar/1
router.post('/eliminar/:id', administrativoController.deleteAdministrativo); // URL final: /api/administrativos/eliminar/1

export default router;