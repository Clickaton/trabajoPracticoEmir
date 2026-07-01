import express from 'express';
import * as alumnoController from '../Controllers/alumnoController.js';
import { requireLogin, verifyToken } from '../middlewares/authHybrid.js';

const router = express.Router();

// Proteger todas las rutas con middleware JWT
router.use(requireLogin);
router.use(verifyToken);

// Rutas de API para Alumnos
router.get('/dashboard', alumnoController.getDashboard);
router.get('/getAlumnos', alumnoController.getAlumnos);
router.get('/getAlumnoById/:id', alumnoController.getAlumnoById);
router.post('/createAlumno', alumnoController.createAlumno);
router.put('/updateAlumno/:id', alumnoController.updateAlumno);
router.delete('/deleteAlumno/:id', alumnoController.deleteAlumno);

export default router;