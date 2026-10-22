import mongoose from 'mongoose';

const materiaSchema = new mongoose.Schema({
    id: { 
        type: Number, 
        required: true, 
        unique: true 
    },
    nombre: { 
        type: String, 
        required: true 
    },
    anio: { 
        type: Number, 
        required: true 
    },
    // Plan de estudios al que pertenece la materia (ver models/PlanEstudio.js).
    // null = todavía sin plan: scripts/migrate-v2.js se lo asigna a las materias existentes.
    plan_id: {
        type: Number,
        default: null,
        index: true
    }
}, {
    timestamps: true
});

const Materia = mongoose.model('Materia', materiaSchema);

export default Materia;