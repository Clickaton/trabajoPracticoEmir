import express from 'express';
import validacionPublicaRoutes from './validacionPublica.routes.js';
import sheetsRoutes from './sheets.routes.js';
import userRoutes from './user.routes.js';
import cohorteRoutes from './cohorte.routes.js';
import alumnoRoutes from './alumno.routes.js';
import materiaRoutes from './materia.routes.js';
import administrativoRoutes from './administrativo.routes.js';
import correlatividadRoutes from './correlatividades.routes.js';
import historialAcademicoRoutes from './historialAcademico.routes.js';
import estadoAcademicoRoutes from './estadoAcademico.routes.js';
import periodoInscripcionRoutes from './periodoInscripcion.routes.js';
import inscripcionRoutes from './inscripcion.routes.js';
import planEstudioRoutes from './planEstudio.routes.js';
import inscripcionFinalRoutes from './inscripcionFinal.routes.js';
import constanciaRoutes from './constancias.routes.js';

const router = express.Router();

// Tabla de rutas del sistema: cada router se monta en su prefijo. Es el único lugar donde se ve "qué URL va adónde".
// El ORDEN importa: Express prueba de arriba hacia abajo y responde la primera que coincide.
router.use('/', validacionPublicaRoutes);
router.use('/api/sheets', sheetsRoutes);
router.use('/', userRoutes);
router.use('/', cohorteRoutes);
router.use('/', alumnoRoutes);
router.use('/api', materiaRoutes);
router.use('/api/administrativos', administrativoRoutes);
router.use('/api/correlatividades', correlatividadRoutes);
router.use('/api/historial', historialAcademicoRoutes);
router.use('/api/estado-academico', estadoAcademicoRoutes);
router.use('/api/periodos-inscripcion', periodoInscripcionRoutes);
router.use('/api/inscripciones', inscripcionRoutes);
router.use('/api/planes', planEstudioRoutes);
router.use('/api/inscripciones-final', inscripcionFinalRoutes);
router.use('/api/constancias', constanciaRoutes);

export default router;
