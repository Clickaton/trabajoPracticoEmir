const express = require('express');
const app = express();
const UserModel = require('./models/User');
const CohorteModel = require('./models/Cohorte');
const port = 3000;
const userController = require('./userController/userController'); 
const cohorteController = require('./cohorteController/cohorteController');
app.use(express.json());

app.get('/users', userController.getUsers);
app.get('/users/:id', userController.getUserById);
app.post('/users', userController.createUser);
app.put('/users/:id', userController.updateUser);
app.delete('/users/:id', userController.deleteUser);
app.get('/cohortes', cohorteController.getCohortes);
app.get('/cohortes/:id', cohorteController.getCohorteById);
app.post('/cohortes', cohorteController.createCohorte);
app.put('/cohortes/:id', cohorteController.updateCohorte);
app.delete('/cohortes/:id', cohorteController.deleteCohorte);
app.post('/cohortes/:cohorteId/usuarios', cohorteController.addUserToCohorte);


app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});