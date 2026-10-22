import mongoose from 'mongoose';
import User from './User.js'; 
import { TIPOS_INGRESO } from '../utils/ingresoAlumno.js';

// REFACTORIZACIÓN: Migración a diseño polimórfico mediante Discriminadores de Mongoose.
// Alumno ya no crea una colección propia; ahora extiende directamente del esquema base 'User' (Herencia).
// Los campos comunes (id, name, email, password, createdAt, updatedAt) se heredan automáticamente,
// por lo que se eliminaron de este archivo para evitar redundancia de datos.
const Alumno = User.discriminator('Alumno', new mongoose.Schema({

    // NUEVO CAMPO: DNI del alumno
    dni: { 
        type: String, 
        required: true,
        unique: true 
    },
    
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
    },

    // --- Datos de ingreso (informativos) ---
    // Con qué situación ingresó el alumno a la carrera
    tipoIngreso: {
        type: String,
        enum: [...TIPOS_INGRESO],
        default: 'Inicial'
    },
    // Pase desde otro instituto
    pase: {
        esPase: { type: Boolean, default: false },
        institutoOrigen: { type: String, default: '', trim: true },
        fechaPase: { type: Date, default: null },
        observaciones: { type: String, default: '', trim: true }
    }
}));

export default Alumno;