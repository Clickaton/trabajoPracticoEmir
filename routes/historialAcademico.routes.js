import express from 'express';
import historialAcademicoController from '../Controllers/historialAcademicoController.js';
import { requireLogin } from '../middlewares/authHybrid.js';

const router = express.Router();

// Proteger todas las rutas con middleware JWT
router.use(requireLogin);

router.get('/', historialAcademicoController.getHistorial);                           // GET    /api/historial
router.get('/alumno/:alumnoId', historialAcademicoController.getHistorialByAlumno);   // GET    /api/historial/alumno/101
router.post('/', historialAcademicoController.createRegistro);                        // POST   /api/historial
router.put('/:id', historialAcademicoController.updateRegistro);                      // PUT    /api/historial/1
router.delete('/:id', historialAcademicoController.deleteRegistro);

export default router;