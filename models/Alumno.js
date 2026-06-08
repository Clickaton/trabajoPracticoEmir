import mongoose from 'mongoose';

const alumnoSchema = new mongoose.Schema({
    id: { 
        type: Number, 
        required: true, 
        unique: true 
    },
    name: { 
        type: String, 
        required: true 
    },
    email: { 
        type: String, 
        required: true 
    },
    password: { 
        type: String, 
        required: true 
    },
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
    // Guarda el ID numérico de la cohorte a la que pertenece
    cohorte_id: {
        type: Number,
        default: null // Por defecto arranca en null porque un alumno nuevo puede no tener cohorte asignada aún
    }
}, {
    timestamps: true
});

const Alumno = mongoose.model('Alumno', alumnoSchema);

export default Alumno;