import mongoose from 'mongoose';

const administrativoSchema = new mongoose.Schema({
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
    rol: {
        type: String,
        required: true
    },
    area: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

const Administrativo = mongoose.model('Administrativo', administrativoSchema);

export default Administrativo;