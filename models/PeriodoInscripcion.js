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
    },
    // 'Cursada' = inscripción a materias. 'Final' = inscripción a mesas de examen final.
    tipo: {
        type: String,
        enum: ['Cursada', 'Final'],
        default: 'Cursada'
    },
    // Fecha de la mesa de examen (solo períodos de tipo 'Final'; informativa)
    fechaExamen: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

const PeriodoInscripcion = mongoose.model('PeriodoInscripcion', periodoInscripcionSchema);

export default PeriodoInscripcion;