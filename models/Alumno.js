import mongoose from 'mongoose';
import User from './User.js'; 

// REFACTORIZACIÓN: Migración a diseño polimórfico mediante Discriminadores de Mongoose.
// Alumno ya no crea una colección propia; ahora extiende directamente del esquema base 'User' (Herencia).
// Los campos comunes (id, name, email, password, createdAt, updatedAt) se heredan automáticamente,
// por lo que se eliminaron de este archivo para evitar redundancia de datos.
const Alumno = User.discriminator('Alumno', new mongoose.Schema({
    
    // Definición exclusiva de atributos específicos del perfil estudiante:
    legajo: { 
        type: String, 
        required: true,
        unique: true 
    },
    activo: { 
        type: Boolean, 
        required: true 
    },
    fecha_inscripcion: { 
        type: Date, 
        required: true 
    },
    cohorte_id: {
        type: Number,
        default: null // Permite registrar al alumno antes de asignarle una cursada específica
    }
}));

export default Alumno;