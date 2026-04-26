const express = require('express');
const router = express.Router();
const cohorteController = require('../controllers/cohorteController');

// Rutas de API para Cohortes
router.get('/getCohortes', cohorteController.getCohortes);
router.get('/getCohorteById/:id', cohorteController.getCohorteById);
router.post('/crearCohorte', cohorteController.createCohorte);
router.put('/updateCohorte/:id', cohorteController.updateCohorte);
router.delete('/deleteCohorte/:id', cohorteController.deleteCohorte);
router.post('/cohorte/:cohorteId/addUser', cohorteController.addUserToCohorte);
router.post('/cohorte/:cohorteId/removeUser', cohorteController.removeUserFromCohorte);
router.get('/cohorte/:cohorteId/users', cohorteController.getUsersInCohorte);
router.get('/cohorte/:cohorteId/materia', cohorteController.getMateriaOfCohorte);
router.get('/cohorte/:cohorteId/duration', cohorteController.getCohorteDuration);
router.get('/cohortesWithUsers', cohorteController.getAllCohortesWithUsers);


module.exports = router;