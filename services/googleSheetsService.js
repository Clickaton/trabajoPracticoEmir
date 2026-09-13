import { google } from 'googleapis';

// Helper para inicializar el cliente con los tokens del usuario logueado
const getAuthClient = (tokens) => {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials(tokens);
    return oauth2Client;
};

// Le agregamos el parámetro "alumnos = []" para recibir la lista desde la BBDD
export const crearOObtenerPlanilla = async (cohorteNombre, tokens, alumnos = []) => {
    const auth = getAuthClient(tokens);
    const drive = google.drive({ version: 'v3', auth });
    
    // Inicializamos la API de Sheets para poder escribir en las celdas
    const sheets = google.sheets({ version: 'v4', auth }); 

    // 1. Buscar si ya existe la carpeta maestra
    let folderId;
    const resFolder = await drive.files.list({
        q: "name='Sistema de Alumnos ISFT 225' and mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields: 'files(id, name)'
    });

    if (resFolder.data.files.length > 0) {
        folderId = resFolder.data.files[0].id;
    } else {
        const folder = await drive.files.create({
            resource: {
                name: 'Sistema de Alumnos ISFT 225',
                mimeType: 'application/vnd.google-apps.folder'
            },
            fields: 'id'
        });
        folderId = folder.data.id;
    }

    // 2. Buscar si ya existe la planilla de esta cohorte específica
    const nombrePlanilla = `Alumnos Cohorte ${cohorteNombre}`;
    let spreadsheetId;
    
    const resSheet = await drive.files.list({
        q: `name='${nombrePlanilla}' and '${folderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
        fields: 'files(id, name)'
    });

    if (resSheet.data.files.length > 0) {
        spreadsheetId = resSheet.data.files[0].id;
    } else {
        // Si no existe, crea la planilla vacía
        const sheet = await drive.files.create({
            resource: {
                name: nombrePlanilla,
                mimeType: 'application/vnd.google-apps.spreadsheet',
                parents: [folderId]
            },
            fields: 'id'
        });
        spreadsheetId = sheet.data.id;

        // ESCRITURA DE DATOS AL CREAR EL ARCHIVO
        // Preparamos la matriz de datos. La primera fila son los encabezados.
        const filasDeDatos = [
            ['ID', 'Nombre', 'Email', 'Legajo']
        ];

        // Recorremos los alumnos y los agregamos debajo como nuevas filas
        alumnos.forEach(alumno => {
            filasDeDatos.push([
                alumno.id,
                alumno.name,
                alumno.email,
                alumno.legajo || 'Sin asignar'
            ]);
        });

        // Inyectamos todo el bloque de datos a partir de la celda A1
        await sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: 'A1', 
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: filasDeDatos
            }
        });
    }

    return spreadsheetId;
};

// Función para leer los datos del Excel y traerlos a tu sistema
export const leerPlanilla = async (spreadsheetId, tokens) => {
    const auth = getAuthClient(tokens);
    const sheets = google.sheets({ version: 'v4', auth });

    // Leemos desde la fila 2 para saltearnos los encabezados (A2 hasta D)
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: 'A2:D', 
    });

    // Si no hay datos, devolvemos un array vacío
    return response.data.values || [];
};

// Función para actualizar un alumno puntual en la planilla cuando se edita desde el sistema
export const actualizarAlumnoEnPlanilla = async (spreadsheetId, tokens, alumno) => {
    const auth = getAuthClient(tokens);
    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Buscamos todas las filas de la columna A (IDs) para localizar al alumno
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: 'A1:A', 
    });

    const filas = response.data.values || [];
    let filaIndex = -1;

    // 2. Encontramos el número exacto de fila
    for (let i = 0; i < filas.length; i++) {
        if (filas[i][0] == alumno.id) {
            filaIndex = i + 1; // +1 porque Sheets arranca en 1 y no en 0
            break;
        }
    }

    // 3. Si lo encuentra, actualiza la fila completa con los nuevos datos
    if (filaIndex !== -1) {
        await sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: `A${filaIndex}:D${filaIndex}`, 
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [[
                    alumno.id,
                    alumno.name,
                    alumno.email,
                    alumno.legajo || 'Sin asignar'
                ]]
            }
        });
    }
};