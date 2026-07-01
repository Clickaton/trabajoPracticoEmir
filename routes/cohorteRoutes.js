import express from 'express';
import cohorteController from '../Controllers/cohorteController.js';
import { requireLogin } from '../middlewares/authHybrid.js';

const router = express.Router();

// Proteger todas las rutas con middleware JWT
router.use(requireLogin);

router.get('/getCohortes', cohorteController.getCohortes);
router.get('/getCohorteById/:id', cohorteController.getCohorteById);
router.post('/crearCohorte', cohorteController.createCohorte);
router.put('/updateCohorte/:id', cohorteController.updateCohorte);
router.delete('/deleteCohorte/:id', cohorteController.deleteCohorte);
router.post('/cohorte/:cohorteId/addUser', cohorteController.addUserToCohorte);
router.post('/cohorte/:cohorteId/removeUser', cohorteController.removeUserFromCohorte);
router.get('/cohorte/:cohorteId/users', cohorteController.getUsersInCohorte);
//router.get('/cohorte/:cohorteId/duration', cohorteController.getCohorteDuration);

export default router;