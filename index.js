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

// Configuración del motor de plantillas Pug
app.set('view engine', 'pug');
app.set('views', './views'); // Le indicamos a express que la carpeta se llama 'view'

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Necesario para procesar los datos enviados por formularios HTML

//Usuario
app.get('/getUsers', userController.getUsers);
app.get('/registerUser', userController.getRegisterForm); 
app.get('/editUser/:id', userController.getEditForm); // Nueva ruta para ver el formulario
app.get('/getUserById/:id', userController.getUserById);
app.post('/createUser', userController.createUser);
app.post('/updateUser/:id', userController.updateUser); // Cambiado a POST para HTML
app.post('/deleteUser/:id', userController.deleteUser);
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