import express from 'express';
import correlatividadController from '../Controllers/correlatividadController.js';

const router = express.Router();

router.get('/', correlatividadController.getCorrelatividades);                      // GET    /api/correlatividades
router.get('/materia/:materiaId', correlatividadController.getRequisitosByMateria); // GET    /api/correlatividades/materia/1
router.get('/:id', correlatividadController.getCorrelatividadById);                 // GET    /api/correlatividades/1
router.post('/', correlatividadController.createCorrelatividad);                    // POST   /api/correlatividades
router.put('/:id', correlatividadController.updateCorrelatividad);                  // PUT    /api/correlatividades/1
router.delete('/:id', correlatividadController.deleteCorrelatividad);               // DELETE /api/correlatividades/1

export default router;