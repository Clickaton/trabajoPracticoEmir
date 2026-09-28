import express from 'express';
import * as alumnoController from '../Controllers/alumnoController.js';
import { requireLogin, verifyToken, requireRole, requireOwnershipOrAdmin } from '../middlewares/authHybrid.js';

const router = express.Router();
const rolesPermitidosAdministrativo = ['Administrativo', 'Direccion', 'Secretario'];
const rolesPermitidosAlumnoAdministrativo = ['Alumno', 'Administrativo', 'Direccion', 'Secretario'];


// Proteger todas las rutas con middleware JWT
router.use(requireLogin);
router.use(verifyToken);

// Rutas de API para Alumnos
router.get('/dashboard', requireRole('Alumno'), alumnoController.getDashboard);
router.get('/getAlumnos', requireRole(rolesPermitidosAdministrativo), alumnoController.getAlumnos);
router.get('/getAlumnoById/:id', requireRole(rolesPermitidosAlumnoAdministrativo), requireOwnershipOrAdmin('id'), alumnoController.getAlumnoById);
router.post('/createAlumno', requireRole(rolesPermitidosAdministrativo), alumnoController.createAlumno);
router.put('/updateAlumno/:id', requireRole(rolesPermitidosAlumnoAdministrativo), requireOwnershipOrAdmin('id'), alumnoController.updateAlumno);
router.delete('/deleteAlumno/:id', requireRole(rolesPermitidosAdministrativo), requireOwnershipOrAdmin('id'), alumnoController.deleteAlumno);

export default router;