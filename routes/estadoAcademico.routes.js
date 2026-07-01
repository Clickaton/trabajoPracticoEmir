import express from 'express';
import estadoAcademicoController from '../Controllers/estadoAcademicoController.js';
import { verifyToken } from '../middlewares/authHybrid.js';

const router = express.Router();

// Proteger ruta con middleware JWT
router.use(verifyToken);
router.get('/:alumnoId', estadoAcademicoController.getEstadoAcademico);

export default router;