import mongoose from 'mongoose';
import User from './User.js'; 

// REFACTORIZACIÓN: Al igual que el modelo Alumno, este esquema hereda de 'User' 
// para guardar todos los registros en la colección unificada 'usuarios'.
// Internamente, Mongoose etiquetará a estos documentos bajo el tipoPerfil: 'Personal'.
const Administrativo = User.discriminator('Personal', new mongoose.Schema({
    
    // Atributos exclusivos del equipo de gestión y docencia (los datos base ya se heredan del padre):
    rol: {
        type: String,
        required: true,
        // Validación estricta de seguridad a nivel de base de datos.
        // Si el frontend intenta guardar un cargo que no coincida exactamente con esta lista 
        // (por ejemplo, con errores de tipeo o roles inventados), Mongoose bloquea la operación.
        enum: ['Administrativo', 'Secretario', 'Direccion', 'Bibliotecario', 'Profesor']
    },
    area: {
        type: String,
        required: true
    }
}));

export default Administrativo;