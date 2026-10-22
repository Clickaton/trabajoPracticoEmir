import express from 'express';
import inscripcionController from '../Controllers/inscripcionController.js';
import { verifyToken, requireOwnershipOrAdmin, requireStaffApi, isAdminRole } from '../middlewares/authHybrid.js';

const router = express.Router();

// Proteger todas las rutas con middleware JWT
router.use(verifyToken);

// Listado de TODAS las inscripciones (con el nombre de cada alumno): solo el personal. Un alumno ve las suyas en /alumno/:alumnoId
router.get('/', requireStaffApi, inscripcionController.getInscripciones);
router.get('/alumno/:alumnoId', requireOwnershipOrAdmin('alumnoId'), inscripcionController.getInscripcionesByAlumno);
router.post(
  '/',
  (req, res, next) => {
    const esAdmin = isAdminRole(req.user);

    if (!esAdmin) {
      req.body.alumno_id = req.user.id;
    }

    next();
  },
  inscripcionController.createInscripcion
);
router.delete('/:id', inscripcionController.deleteInscripcion); // la pertenencia de la inscripción se controla dentro

export default router;