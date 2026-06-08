import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    id: {
        type: Number,
        required: true,
        unique: true // Asegura que no haya dos usuarios con el mismo ID numérico
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
    }
}, {
    timestamps: true // agrega automáticamente fecha de creación y modificación
});

const User = mongoose.model('User', userSchema);

export default User;