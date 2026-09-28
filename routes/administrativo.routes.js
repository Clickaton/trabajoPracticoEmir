import express from 'express';
import administrativoController from '../Controllers/administrativoController.js';
import { requireRole, verifyToken } from '../middlewares/authHybrid.js';

const router = express.Router();
const rolesPermitidos = ['Administrativo', 'Direccion', 'Secretario' ];

// Rutas para renderizar vistas (Pantallas)
router.get('/', requireRole(rolesPermitidos), administrativoController.getAdministrativos);

// Rutas de procesamiento (Acciones de los formularios)
router.get('/:id', requireRole(rolesPermitidos), administrativoController.getAdministrativoById);
router.post('/', requireRole(rolesPermitidos), administrativoController.createAdministrativo);
router.post('/editar/:id', requireRole(rolesPermitidos), administrativoController.updateAdministrativo);
router.post('/eliminar/:id', requireRole(rolesPermitidos), administrativoController.deleteAdministrativo);
router.put('/updateAlumnoAdm/:id', requireRole(rolesPermitidos), administrativoController.updateAlumno);   

export default router;