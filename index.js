const express = require('express');
const app = express();
const UserModel = require('./models/User');
const CohorteModel = require('./models/Cohorte');
const MateriaModel = require('./models/Materia');
const AlumnoModel = require('./models/Alumno');
const port = 3000;
const userController = require('./Controllers/userController'); 
const cohorteController = require('./Controllers/cohorteController');
const materiaController = require('./Controllers/materiaController');
const alumnoController = require('./Controllers/alumnoController');

app.use(express.json());

//Usuario
app.get('/getUsers', userController.getUsers);
app.get('/getUserById/:id', userController.getUserById);
app.post('/createUser', userController.createUser);
app.put('/updateUser/:id', userController.updateUser);
app.delete('/deleteUser/:id', userController.deleteUser);
//Cohorte
app.get('/getCohortes', cohorteController.getCohortes);
app.get('/getCohorteById/:id', cohorteController.getCohorteById);
app.post('/crearCohorte', cohorteController.createCohorte);
app.put('/updateCohorte/:id', cohorteController.updateCohorte);
app.delete('/deleteCohorte/:id', cohorteController.deleteCohorte);
app.post('/cohorte/:cohorteId/addUser', cohorteController.addUserToCohorte);
//Materia
app.get('/api/materias', materiaController.getMaterias);
app.get('/api/materias/:id', materiaController.getMateriaById);
app.post('/api/materias', materiaController.createMateria);
app.put('/api/materias/:id', materiaController.updateMateria);
app.delete('/api/materias/:id', materiaController.deleteMateria);
// Alumno 
app.get('/getAlumnos', alumnoController.getAlumnos);
app.get('/getAlumnoById/:id', alumnoController.getAlumnoById);
app.post('/createAlumno', alumnoController.createAlumno);
app.put('/updateAlumno/:id', alumnoController.updateAlumno);
app.delete('/deleteAlumno/:id', alumnoController.deleteAlumno);

app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});