const express = require('express');
const app = express();
const UserModel = require('./models/User');
const port = 3000;
const userController = require('./userController/userController'); 
app.use(express.json());

app.get('/users', userController.getUsers);
app.get('/users/:id', userController.getUserById);
app.post('/users', userController.createUser);
app.put('/users/:id', userController.updateUser);
app.delete('/users/:id', userController.deleteUser);

app.delete("/temario/:id", (req, res) => { 
});

app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});