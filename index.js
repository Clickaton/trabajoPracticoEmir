const express = require('express');
const app = express();
const port = 3000;

// Importar enrutadores
const userRoutes = require('./routes/userRoutes');
const cohorteRoutes = require('./routes/cohorteRoutes');
const materiaRoutes = require('./routes/materiaRoutes');
const alumnoRoutes = require('./routes/alumnoRoutes');

// Configuración del motor de plantillas Pug
app.set('view engine', 'pug');
app.set('views', './views');

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Necesario para procesar los datos enviados por formularios HTML

// Usar enrutadores
app.use('/', userRoutes);
app.use('/', cohorteRoutes);
app.use('/', alumnoRoutes);
app.use('/api', materiaRoutes);

app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});