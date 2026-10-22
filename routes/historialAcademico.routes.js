import express from 'express';
import historialAcademicoController from '../Controllers/historialAcademicoController.js';
import { verifyToken, requireAdminApi, requireOwnershipOrAdmin } from '../middlewares/authHybrid.js';

const router = express.Router();

// Es una API consumida con fetch(): los rechazos se responden en JSON (requireLogin/requireRole redirigen a pantallas HTML)
router.use(verifyToken);

// Consultas
router.get('/', requireAdminApi, historialAcademicoController.getHistorial);                                                // GET    /api/historial
router.get('/alumno/:alumnoId', requireOwnershipOrAdmin('alumnoId'), historialAcademicoController.getHistorialByAlumno);   // GET    /api/historial/alumno/101  (el propio alumno o un administrativo)

// Modificaciones: SOLO administrativos. Antes PUT y DELETE usaban requireOwnershipOrAdmin('id'), que compara el id del registro
// con el del usuario: un alumno con el mismo número que un registro podía modificarlo o borrarlo.
router.post('/', requireAdminApi, historialAcademicoController.createRegistro);                                             // POST   /api/historial
router.put('/:id', requireAdminApi, historialAcademicoController.updateRegistro);                                           // PUT    /api/historial/1
router.delete('/:id', requireAdminApi, historialAcademicoController.deleteRegistro);                                        // DELETE /api/historial/1[?eliminarFinales=true]

export default router;
