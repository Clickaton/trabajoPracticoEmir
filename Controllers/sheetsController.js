import { crearOObtenerPlanilla, leerPlanilla } from '../services/googleSheetsService.js';
import Cohorte from '../models/Cohorte.js';
import Alumno from '../models/Alumno.js';
import { normalizarEmail, emailValido, emailEnUso } from '../services/usuarioService.js';

// Se abre desde una pestaña nueva del navegador (no desde un fetch): por eso estos errores son texto simple.
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

            // Lo guardamos en MongoDB para la próxima
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

// Aplica al sistema las filas leídas de la planilla (columnas A a D: ID, nombre, email y legajo).
// Reglas para no pisar datos buenos con datos malos:
//  - una celda vacía NO borra el dato del sistema (antes dejaba el nombre o el email en blanco y el legajo en "Sin asignar");
//  - solo se tocan alumnos que figuran en la cohorte (no cualquier ID escrito en la planilla);
//  - un email con formato inválido o que ya usa otra cuenta, o un legajo repetido, se omite y se informa.
// Devuelve { actualizados, omitidos }: cuántos alumnos cambiaron de verdad y qué filas no se pudieron aplicar (y por qué).
export const aplicarFilasDePlanilla = async (filas, idsDeLaCohorte) => {
    const ids = new Set(idsDeLaCohorte);
    const omitidos = [];
    let actualizados = 0;

    for (const fila of filas) {
        // fila[0] es ID, fila[1] es Nombre, fila[2] es Email, fila[3] es Legajo
        const idAlumno = parseInt(fila[0], 10);
        if (Number.isNaN(idAlumno)) continue;

        if (!ids.has(idAlumno)) {
            omitidos.push(`ID ${idAlumno}: no pertenece a esta cohorte.`);
            continue;
        }

        const cambios = {};

        const nombre = String(fila[1] ?? '').trim();
        if (nombre) cambios.name = nombre;

        const email = normalizarEmail(fila[2]);
        if (email) {
            if (!emailValido(email)) {
                omitidos.push(`ID ${idAlumno}: el email "${email}" no es válido.`);
            } else if (await emailEnUso(email, idAlumno)) {
                omitidos.push(`ID ${idAlumno}: el email "${email}" ya lo usa otra cuenta.`);
            } else {
                cambios.email = email;
            }
        }

        const legajo = String(fila[3] ?? '').trim();
        if (legajo && legajo !== 'Sin asignar') {
            if (await Alumno.exists({ legajo, id: { $ne: idAlumno } })) {
                omitidos.push(`ID ${idAlumno}: el legajo "${legajo}" ya lo usa otro alumno.`);
            } else {
                cambios.legajo = legajo;
            }
        }

        if (Object.keys(cambios).length === 0) continue;

        // Sin { new: true }: devuelve el alumno como estaba, para contar solo lo que realmente cambió
        const antes = await Alumno.findOneAndUpdate({ id: idAlumno }, cambios);
        if (antes && Object.entries(cambios).some(([campo, valor]) => antes[campo] !== valor)) actualizados++;
    }

    return { actualizados, omitidos };
};

// Trae a MongoDB los cambios hechos en la planilla. Responde JSON porque lo llama el botón "Sincronizar" del panel con fetch().
export const sincronizarCohorte = async (req, res) => {
    try {
        const { cohorteId } = req.params;
        const userTokens = req.user.googleTokens;

        if (!userTokens) {
            return res.status(403).json({ error: "No tenés una cuenta de Google vinculada. Cerrá sesión y volvé a entrar con el botón de Google." });
        }

        const cohorte = await Cohorte.findOne({ id: parseInt(cohorteId) });
        if (!cohorte || !cohorte.spreadsheetId) {
            return res.status(404).json({ error: "Esta cohorte no tiene una planilla vinculada." });
        }

        // 1. Descargamos las filas desde Google Sheets y 2. las aplicamos al sistema
        const filas = await leerPlanilla(cohorte.spreadsheetId, userTokens);
        const { actualizados, omitidos } = await aplicarFilasDePlanilla(filas, cohorte.userList);

        // 3. Respondemos al cliente con el resultado
        res.status(200).json({
            message: actualizados === 0
                ? "La planilla y el sistema ya estaban al día."
                : `Sincronización exitosa: se actualizó ${actualizados === 1 ? '1 alumno' : actualizados + ' alumnos'}.`,
            actualizados,
            omitidos
        });

    } catch (error) {
        console.error("Error al sincronizar con Google Sheets:", error);
        res.status(500).json({ error: "Error interno al sincronizar con Google Sheets." });
    }
};
