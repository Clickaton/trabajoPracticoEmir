import express from 'express';
import inscripcionController from '../Controllers/inscripcionController.js';

const router = express.Router();

router.get('/', inscripcionController.getInscripciones);                           // GET    /api/inscripciones
router.get('/alumno/:alumnoId', inscripcionController.getInscripcionesByAlumno);   // GET    /api/inscripciones/alumno/101
router.post('/', inscripcionController.createInscripcion);                         // POST   /api/inscripciones
router.delete('/:id', inscripcionController.deleteInscripcion);                    // DELETE /api/inscripciones/1

export default router;