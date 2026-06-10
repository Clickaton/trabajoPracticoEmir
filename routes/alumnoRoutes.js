import express from 'express';
import * as alumnoController from '../Controllers/alumnoController.js';

const router = express.Router();

// Rutas de API para Alumnos
router.get('/getAlumnos', alumnoController.getAlumnos);
router.get('/getAlumnoById/:id', alumnoController.getAlumnoById);
router.post('/createAlumno', alumnoController.createAlumno);
router.put('/updateAlumno/:id', alumnoController.updateAlumno);
router.delete('/deleteAlumno/:id', alumnoController.deleteAlumno);

export default router;