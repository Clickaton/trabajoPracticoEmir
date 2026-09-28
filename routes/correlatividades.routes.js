import express from 'express';
import correlatividadController from '../Controllers/correlatividadController.js';
import { requireLogin, requireRole } from '../middlewares/authHybrid.js';

const router = express.Router();
const rolesPermitidos = ['Administrativo', 'Direccion', 'Secretario' ];
// Proteger todas las rutas con middleware JWT
router.use(requireLogin);


router.get('/', correlatividadController.getCorrelatividades);                      // GET    /api/correlatividades
router.get('/materia/:materiaId', correlatividadController.getRequisitosByMateria); // GET    /api/correlatividades/materia/1
router.get('/:id', correlatividadController.getCorrelatividadById);                 // GET    /api/correlatividades/1
router.post('/', requireRole(rolesPermitidos), correlatividadController.createCorrelatividad);                    // POST   /api/correlatividades
router.put('/:id', requireRole(rolesPermitidos), correlatividadController.updateCorrelatividad);                  // PUT    /api/correlatividades/1
router.delete('/:id', requireRole(rolesPermitidos), correlatividadController.deleteCorrelatividad);               // DELETE /api/correlatividades/1

export default router;