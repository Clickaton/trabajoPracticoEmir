import express from 'express';
import historialAcademicoController from '../Controllers/historialAcademicoController.js';
import { requireLogin, requireRole, requireOwnershipOrAdmin } from '../middlewares/authHybrid.js';

const router = express.Router();
const rolesPermitidos = ['Administrativo', 'Direccion', 'Secretario'];
// Proteger todas las rutas con middleware JWT
router.use(requireLogin);

router.get('/', requireRole(rolesPermitidos), historialAcademicoController.getHistorial);                           // GET    /api/historial
router.get('/alumno/:alumnoId', requireOwnershipOrAdmin('alumnoId'), historialAcademicoController.getHistorialByAlumno);   // GET    /api/historial/alumno/101
router.post('/', requireRole(rolesPermitidos), historialAcademicoController.createRegistro);                        // POST   /api/historial
router.put('/:id', requireOwnershipOrAdmin('id'), historialAcademicoController.updateRegistro);                      // PUT    /api/historial/1
router.delete('/:id', requireOwnershipOrAdmin('id'), historialAcademicoController.deleteRegistro);

export default router;