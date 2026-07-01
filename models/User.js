import mongoose from 'mongoose';
import mongooseSequence from 'mongoose-sequence';
import bcrypt from 'bcrypt';

const AutoIncrement = mongooseSequence(mongoose);
const SALT_ROUNDS = 12;

// Configuraciones base para la herencia
const baseOptions = {
    discriminatorKey: 'tipoPerfil', // Llave interna invisible para Mongoose
    collection: 'usuarios',         // Todos los registros van a ir a parar acá
    timestamps: true                // Aplica fecha de creación/modificación a todos
};

const isHashedPassword = (value) => typeof value === 'string' && /^\$2[aby]\$/.test(value);

const hashPassword = async (value) => {
    if (!value || typeof value !== 'string' || isHashedPassword(value)) {
        return value;
    }

    return bcrypt.hash(value, SALT_ROUNDS);
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

userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        return next();
    }

    try {
        this.password = await hashPassword(this.password);
        next();
    } catch (error) {
        next(error);
    }
});

userSchema.pre('findOneAndUpdate', async function(next) {
    const update = this.getUpdate();
    const passwordToUpdate = update?.password ?? update?.$set?.password;

    if (!passwordToUpdate) {
        return next();
    }

    try {
        const hashedPassword = await hashPassword(passwordToUpdate);

        if (update?.password) {
            update.password = hashedPassword;
        } else if (update?.$set) {
            update.$set.password = hashedPassword;
        }

        next();
    } catch (error) {
        next(error);
    }
});

userSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

export default User;