import express from 'express';
import estadoAcademicoController from '../Controllers/estadoAcademicoController.js';
import { verifyToken, requireAdminApi, requireOwnershipOrAdmin } from '../middlewares/authHybrid.js';

const router = express.Router();

// Proteger rutas con middleware JWT
router.use(verifyToken);

// Semáforo de toda una cohorte: datos de todos los alumnos, solo administrativos
router.get('/cohorte/:cohorteId/semaforo', requireAdminApi, estadoAcademicoController.getSemaforoCohorte);   // GET /api/estado-academico/cohorte/3/semaforo

// Estado de un alumno: el propio alumno o un administrativo
router.get('/:alumnoId', requireOwnershipOrAdmin('alumnoId'), estadoAcademicoController.getEstadoAcademico);   // GET /api/estado-academico/101

export default router;
