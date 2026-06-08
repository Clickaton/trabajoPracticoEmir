import mongoose from 'mongoose';

const cohorteSchema = new mongoose.Schema({
    id: { 
        type: Number, 
        required: true, 
        unique: true 
    },
    name: { 
        type: String, 
        required: true 
    },
    startDate: { 
        type: Date, 
        required: true 
    },
    userList: [{ 
        type: Number // Guardaremos los IDs personalizados de los alumnos acá
    }]
}, {
    timestamps: true
});

const Cohorte = mongoose.model('Cohorte', cohorteSchema);

export default Cohorte;