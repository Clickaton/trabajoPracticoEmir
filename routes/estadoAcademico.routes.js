import express from 'express';
import estadoAcademicoController from '../Controllers/estadoAcademicoController.js';
import { verifyToken, requireOwnershipOrAdmin } from '../middlewares/authHybrid.js';

const router = express.Router();

// Proteger ruta con middleware JWT
router.use(verifyToken);
router.get('/:alumnoId', requireOwnershipOrAdmin('alumnoId'), estadoAcademicoController.getEstadoAcademico);

export default router;