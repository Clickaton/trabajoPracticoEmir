import mongoose from 'mongoose';
import mongooseSequence from 'mongoose-sequence';

const AutoIncrement = mongooseSequence(mongoose);

// Configuraciones base para la herencia
const baseOptions = {
    discriminatorKey: 'tipoPerfil', // Llave interna invisible para Mongoose
    collection: 'usuarios',         // Todos los registros van a ir a parar acá
    timestamps: true                // Aplica fecha de creación/modificación a todos
};

const userSchema = new mongoose.Schema({
    //ACA EL MOONGOSE-SEQUENCE VA A INYECTAR EL ID SECUENCIAL, POR CADA USAURIO QUE SE CREA TENDRA SU ID DE MENEERA SECUENCIA COMO EL INCREMENTAL DE SQL
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
}, baseOptions);

// Le decimos que inyecte un campo llamado "id" numérico y lo vaya sumando (1, 2, 3...)
userSchema.plugin(AutoIncrement, { inc_field: 'id' });

const User = mongoose.model('User', userSchema);

export default User;