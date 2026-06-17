import mongoose from 'mongoose';

const correlatividadSchema = new mongoose.Schema({
    id: { 
        type: Number, 
        required: true, 
        unique: true 
    },
    materia_id: { 
        type: Number, 
        required: true 
    },
    requisito_id: { 
        type: Number, 
        required: true 
    },
    tipo_requisito: { 
        type: String, 
        required: true,
        enum: ['Regular', 'Aprobada'] // Validación estricta a nivel de base de datos
    }
}, {
    timestamps: true
});

const Correlatividad = mongoose.model('Correlatividad', correlatividadSchema);

export default Correlatividad;