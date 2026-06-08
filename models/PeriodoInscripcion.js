import mongoose from 'mongoose';

const periodoInscripcionSchema = new mongoose.Schema({
    id: { 
        type: Number, 
        required: true, 
        unique: true 
    },
    nombre: { 
        type: String, 
        required: true 
    },
    fechaInicio: { 
        type: Date, 
        required: true 
    },
    fechaFin: { 
        type: Date, 
        required: true 
    },
    horaInicio: { 
        type: String, 
        required: true 
    },
    horaFin: { 
        type: String, 
        required: true 
    },
    activo: { 
        type: Boolean, 
        default: false 
    }
}, {
    timestamps: true
});

const PeriodoInscripcion = mongoose.model('PeriodoInscripcion', periodoInscripcionSchema);

export default PeriodoInscripcion;