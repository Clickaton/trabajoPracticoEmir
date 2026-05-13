import express from 'express';
import estadoAcademicoController from '../Controllers/estadoAcademicoController.js';

const router = express.Router();

router.get('/:alumnoId', estadoAcademicoController.getEstadoAcademico); // GET /api/estado-academico/101

export default router;