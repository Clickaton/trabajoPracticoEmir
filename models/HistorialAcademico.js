import mongoose from 'mongoose';

const historialAcademicoSchema = new mongoose.Schema({
    id: { 
        type: Number, 
        required: true, 
        unique: true 
    },
    alumno_id: { 
        type: Number, 
        required: true 
    },
    materia_id: { 
        type: Number, 
        required: true 
    },
    estado: { 
        type: String, 
        required: true,
        enum: ['Cursando', 'Regular', 'Aprobada'] // Validación estricta en la BD
    },
    nota: { 
        type: Number, 
        default: null 
    }
}, {
    timestamps: true
});

const HistorialAcademico = mongoose.model('HistorialAcademico', historialAcademicoSchema);

export default HistorialAcademico;