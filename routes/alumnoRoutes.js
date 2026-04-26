const express = require('express');
const router = express.Router();
const alumnoController = require('../controllers/alumnoController');

// Rutas de API para Alumnos
router.get('/getAlumnos', alumnoController.getAlumnos);
router.get('/getAlumnoById/:id', alumnoController.getAlumnoById);
router.post('/createAlumno', alumnoController.createAlumno);
router.put('/updateAlumno/:id', alumnoController.updateAlumno);
router.delete('/deleteAlumno/:id', alumnoController.deleteAlumno);

module.exports = router;