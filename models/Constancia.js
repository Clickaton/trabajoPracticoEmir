import mongoose from 'mongoose';

const constanciaSchema = new mongoose.Schema({
    // ID numérico para seguir tu estándar de base de datos
    id: { 
        type: Number, 
        required: true, 
        unique: true 
    },
    // Vinculamos la constancia con el alumno que la pidió
    alumno_id: { 
        type: Number, 
        required: true 
    },
    tipo_constancia: { 
        type: String, 
        required: true,
        default: 'Alumno Regular'
    },
    presentar_a: {
        type: String,
        required: true // El campo obligatorio que me pediste en el modal
    },
    observaciones: {
        type: String,
        default: '' // El campo opcional
    },
    fecha_emision: { 
        type: Date, 
        default: Date.now 
    },
    fecha_vencimiento: { 
        type: Date, 
        required: true 
    },
    // Un código único (como un UUID) por si querés validar que el PDF no es trucho
    codigo_validacion: { 
        type: String, 
        required: true,
        unique: true
    }
}, {
    timestamps: true // Agrega createdAt y updatedAt automáticamente
});

const Constancia = mongoose.model('Constancia', constanciaSchema);

export default Constancia;