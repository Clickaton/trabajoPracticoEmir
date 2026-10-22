import express from 'express';
import planEstudioController from '../Controllers/planEstudioController.js';
import { requireLogin, requireRole } from '../middlewares/authHybrid.js';

const router = express.Router();
const rolesPermitidos = ['Administrativo', 'Direccion', 'Secretario'];

// Proteger todas las rutas con middleware JWT
router.use(requireLogin);

router.get('/', planEstudioController.getPlanes);                                                    // GET    /api/planes
router.get('/:id', planEstudioController.getPlanById);                                               // GET    /api/planes/1
router.post('/', requireRole(rolesPermitidos), planEstudioController.createPlan);                    // POST   /api/planes
router.put('/:id', requireRole(rolesPermitidos), planEstudioController.updatePlan);                  // PUT    /api/planes/1
router.delete('/:id', requireRole(rolesPermitidos), planEstudioController.deletePlan);               // DELETE /api/planes/1

export default router;
