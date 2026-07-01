import express from 'express';
import inscripcionController from '../Controllers/inscripcionController.js';
import { verifyToken } from '../middlewares/authHybrid.js';

const router = express.Router();

// Proteger todas las rutas con middleware JWT
router.use(verifyToken);

router.get('/', inscripcionController.getInscripciones);
router.get('/alumno/:alumnoId', inscripcionController.getInscripcionesByAlumno);
router.post('/', inscripcionController.createInscripcion);
router.delete('/:id', inscripcionController.deleteInscripcion);

export default router;