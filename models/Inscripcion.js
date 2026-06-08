import mongoose from 'mongoose';

const inscripcionSchema = new mongoose.Schema({
    id: { 
        type: Number, 
        required: true, 
        unique: true 
    },
    alumno_id: { 
        type: Number, 
        required: true 
    },
    cohorte_id: { 
        type: Number, 
        required: true 
    },
    materia_id: { 
        type: Number, 
        required: true 
    },
    periodo_id: { 
        type: Number, 
        required: true 
    },
    fecha: { 
        type: Date, 
        default: Date.now 
    }
}, {
    timestamps: true
});

const Inscripcion = mongoose.model('Inscripcion', inscripcionSchema);

export default Inscripcion;