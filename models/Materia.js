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
    }
}, {
    timestamps: true
});

const Materia = mongoose.model('Materia', materiaSchema);

export default Materia;