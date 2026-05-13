import express from 'express';
import periodoInscripcionController from '../Controllers/periodoInscripcionController.js';

const router = express.Router();

router.get('/', periodoInscripcionController.getPeriodos);                    // GET    /api/periodos-inscripcion
router.get('/activos', periodoInscripcionController.getPeriodosActivos);      // GET    /api/periodos-inscripcion/activos
router.get('/:id', periodoInscripcionController.getPeriodoById);              // GET    /api/periodos-inscripcion/1
router.post('/', periodoInscripcionController.createPeriodo);                 // POST   /api/periodos-inscripcion
router.put('/:id', periodoInscripcionController.updatePeriodo);               // PUT    /api/periodos-inscripcion/1
router.delete('/:id', periodoInscripcionController.deletePeriodo);            // DELETE /api/periodos-inscripcion/1

export default router;