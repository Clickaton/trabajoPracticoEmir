import express from 'express';
import inscripcionFinalController from '../Controllers/inscripcionFinalController.js';
import { verifyToken, requireOwnershipOrAdmin, requireAdminApi, isAdminRole } from '../middlewares/authHybrid.js';

const router = express.Router();

// Proteger todas las rutas con middleware JWT
router.use(verifyToken);

// --- Alumno (o administrativo en su nombre) ---
router.get('/disponibles/:alumnoId', requireOwnershipOrAdmin('alumnoId'), inscripcionFinalController.getDisponibles);  // GET    /api/inscripciones-final/disponibles/5
router.get('/alumno/:alumnoId', requireOwnershipOrAdmin('alumnoId'), inscripcionFinalController.getFinalesByAlumno);    // GET    /api/inscripciones-final/alumno/5
router.post(
  '/',
  (req, res, next) => {
    // Un alumno solo puede inscribirse a sí mismo: se ignora el alumno_id que mande el navegador
    if (!isAdminRole(req.user)) req.body.alumno_id = req.user.id;
    next();
  },
  inscripcionFinalController.createInscripcionFinal                                                                       // POST   /api/inscripciones-final
);
router.delete('/:id', inscripcionFinalController.anularInscripcionFinal);                                               // DELETE /api/inscripciones-final/7  (la pertenencia se controla dentro)

// --- Administrativos ---
router.get('/periodo/:periodoId', requireAdminApi, inscripcionFinalController.getMesa);                             // GET    /api/inscripciones-final/periodo/3
router.put('/:id/resultado', requireAdminApi, inscripcionFinalController.cargarResultado);                          // PUT    /api/inscripciones-final/7/resultado

export default router;
