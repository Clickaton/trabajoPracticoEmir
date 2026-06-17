import express from 'express';
import * as alumnoController from '../Controllers/alumnoController.js';
import { requireLogin } from '../middlewares/auth.js';

const router = express.Router();

// Protegemos TODAS las rutas a continuación aplicando el middleware globalmente a este router
router.use(requireLogin);

// Rutas de API para Alumnos
router.get('/getAlumnos', alumnoController.getAlumnos);
router.get('/getAlumnoById/:id', alumnoController.getAlumnoById);
router.post('/createAlumno', alumnoController.createAlumno);
router.put('/updateAlumno/:id', alumnoController.updateAlumno);
router.delete('/deleteAlumno/:id', alumnoController.deleteAlumno);

export default router;