import express from 'express';
import inscripcionController from '../Controllers/inscripcionController.js';
import { verifyToken, requireOwnershipOrAdmin } from '../middlewares/authHybrid.js';

const router = express.Router();

// Proteger todas las rutas con middleware JWT
router.use(verifyToken);

router.get('/', inscripcionController.getInscripciones);
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
router.delete('/:id', requireOwnershipOrAdmin('id'), inscripcionController.deleteInscripcion);

export default router;