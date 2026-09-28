import express from 'express';
import cohorteController from '../Controllers/cohorteController.js';
import { requireLogin, requireRole } from '../middlewares/authHybrid.js';

const router = express.Router();
const rolesPermitidos = ['Administrativo', 'Direccion', 'Secretario' ];

// Proteger todas las rutas con middleware JWT
router.use(requireLogin);

router.get('/getCohortes', requireRole(rolesPermitidos), cohorteController.getCohortes);
router.get('/getCohorteById/:id', cohorteController.getCohorteById);
router.post('/crearCohorte', requireRole(rolesPermitidos),cohorteController.createCohorte);
router.put('/updateCohorte/:id', requireRole(rolesPermitidos), cohorteController.updateCohorte);
router.delete('/deleteCohorte/:id', requireRole(rolesPermitidos), cohorteController.deleteCohorte);
router.post('/cohorte/:cohorteId/addUser', requireRole(rolesPermitidos), cohorteController.addUserToCohorte);
router.post('/cohorte/:cohorteId/removeUser', requireRole(rolesPermitidos), cohorteController.removeUserFromCohorte);
router.get('/cohorte/:cohorteId/users', requireRole(rolesPermitidos), cohorteController.getUsersInCohorte);
//router.get('/cohorte/:cohorteId/duration', cohorteController.getCohorteDuration);

export default router;