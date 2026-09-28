import mongoose from 'mongoose';

const cohorteSchema = new mongoose.Schema({
    id: {
        type: Number,
        unique: true,
        sparse: true
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
        type: Number
    }],
    spreadsheetId: { type: String, default: null }
}, {
    timestamps: true
});

cohorteSchema.pre('validate', async function(next) {
    if (this.id == null || Number.isNaN(this.id)) {
        const ultimo = await this.constructor.findOne({}, { id: 1 }, { sort: { id: -1 } }).lean();
        this.id = ultimo && typeof ultimo.id === 'number' ? ultimo.id + 1 : 1;
    }
    next();
});

const Cohorte = mongoose.model('Cohorte', cohorteSchema);

export default Cohorte;