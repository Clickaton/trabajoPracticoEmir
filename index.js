const express = require('express');
const app = express();
const UserModel = require('./models/User');
const CohorteModel = require('./models/Cohorte');
const port = 3000;
const userController = require('./userController/userController'); 
const cohorteController = require('./cohorteController/cohorteController');
app.use(express.json());

app.get('/getUsers', userController.getUsers);
app.get('/getUserById/:id', userController.getUserById);
app.post('/createUser', userController.createUser);
app.put('/updateUser/:id', userController.updateUser);
app.delete('/deleteUser/:id', userController.deleteUser);
app.get('/getCohortes', cohorteController.getCohortes);
app.get('/getCohorteById/:id', cohorteController.getCohorteById);
app.post('/crearCohorte', cohorteController.createCohorte);
app.put('/updateCohorte/:id', cohorteController.updateCohorte);
app.delete('/deleteCohorte/:id', cohorteController.deleteCohorte);
app.post('/cohorte/:cohorteId/addUser', cohorteController.addUserToCohorte);


app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});