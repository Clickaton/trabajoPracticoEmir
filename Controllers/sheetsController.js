import { crearOObtenerPlanilla } from '../services/googleSheetsService.js';
import Cohorte from '../models/Cohorte.js';
import Alumno from '../models/Alumno.js';

export const abrirPlanillaCohorte = async (req, res) => {
    try {
        const { cohorteId } = req.params;
        
        // Recuperamos los tokens de Google
        const userTokens = req.user.googleTokens; 

        if (!userTokens) {
            return res.status(403).send("No tenés permisos de Google vinculados. Por favor, cerrá sesión y volvé a entrar usando el botón de Google.");
        }

        // 1. Buscamos la cohorte en la BBDD
        const cohorte = await Cohorte.findOne({ id: parseInt(cohorteId) });
        
        if (!cohorte) {
            return res.status(404).send("Cohorte no encontrada.");
        }

        // 2. Revisamos si ya tenemos un Excel guardado para esta cohorte
        let spreadsheetId = cohorte.spreadsheetId;

        // 3. Si NO existe el ID en MongoDB, llamamos al servicio para que lo cree
        if (!spreadsheetId) {
            const nombreCohorte = cohorte.name;
            
            // Buscamos a todos los alumnos que están guardados en la lista de esta cohorte
            const alumnosDeLaCohorte = await Alumno.find({ id: { $in: cohorte.userList } }).lean();
            
            // Crea el archivo y le pasa los alumnos para inyectarlos en el Excel
            spreadsheetId = await crearOObtenerPlanilla(nombreCohorte, userTokens, alumnosDeLaCohorte);

            // ¡Acá está la clave! Lo guardamos en MongoDB para la próxima
            cohorte.spreadsheetId = spreadsheetId;
            await cohorte.save();
        }

        // 4. Redirigimos directo al Excel
        res.redirect(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);

    } catch (error) {
        console.error("Error abriendo Google Sheets:", error);
        res.status(500).send("Error interno al intentar conectar con Google Sheets.");
    }
};

import { leerPlanilla } from '../services/googleSheetsService.js'; // Acordate de sumar esto arriba en tus imports

// Función que sincroniza los cambios hacia MongoDB
export const sincronizarCohorte = async (req, res) => {
    try {
        const { cohorteId } = req.params;
        const userTokens = req.user.googleTokens;

        if (!userTokens) {
            return res.status(403).send("No tenés permisos de Google vinculados.");
        }

        const cohorte = await Cohorte.findOne({ id: parseInt(cohorteId) });
        if (!cohorte || !cohorte.spreadsheetId) {
            return res.status(404).send("Esta cohorte no tiene una planilla vinculada.");
        }

        // 1. Descargamos las filas desde Google Sheets
        const filas = await leerPlanilla(cohorte.spreadsheetId, userTokens);

        // 2. Recorremos cada fila para actualizar al alumno correspondiente
        for (const fila of filas) {
            // fila[0] es ID, fila[1] es Nombre, fila[2] es Email, fila[3] es Legajo
            const idAlumno = parseInt(fila[0]);
            const nuevoLegajo = fila[3] || 'Sin asignar'; 

            if (!isNaN(idAlumno)) {
                await Alumno.findOneAndUpdate(
                    { id: idAlumno },
                    { 
                        name: fila[1], 
                        email: fila[2],
                        legajo: nuevoLegajo 
                    }
                );
            }
        }

        // 3. Respondemos al cliente que todo salió bien
        res.status(200).send("¡Sincronización exitosa! La base de datos está actualizada.");

    } catch (error) {
        console.error("Error al sincronizar con Google Sheets:", error);
        res.status(500).send("Error interno al sincronizar.");
    }
};