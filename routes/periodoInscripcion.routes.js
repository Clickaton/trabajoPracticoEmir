import express from 'express';
import periodoInscripcionController from '../Controllers/periodoinscripcionController.js';
import { requireLogin, requireRole } from '../middlewares/authHybrid.js';

const router = express.Router();
const rolesPermitidos = ['Administrativo', 'Direccion', 'Secretario'];

// Proteger todas las rutas con middleware JWT
router.use(requireLogin);

router.get('/', periodoInscripcionController.getPeriodos);                    // GET    /api/periodos-inscripcion
router.get('/activos', periodoInscripcionController.getPeriodosActivos);      // GET    /api/periodos-inscripcion/activos
router.get('/:id', periodoInscripcionController.getPeriodoById);              // GET    /api/periodos-inscripcion/1
router.post('/', requireRole(rolesPermitidos), periodoInscripcionController.createPeriodo);                 // POST   /api/periodos-inscripcion
router.put('/:id', requireRole(rolesPermitidos), periodoInscripcionController.updatePeriodo);               // PUT    /api/periodos-inscripcion/1
router.delete('/:id', requireRole(rolesPermitidos), periodoInscripcionController.deletePeriodo);            // DELETE /api/periodos-inscripcion/1

export default router;