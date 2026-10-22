import mongoose from 'mongoose';
import mongooseSequence from 'mongoose-sequence';

const AutoIncrement = mongooseSequence(mongoose);

// Plan de estudios (carrera). Cada Cohorte y cada Materia pertenecen a un plan mediante su campo plan_id,
// y la regla de vencimiento de regularidad se configura acá, plan por plan.
const planEstudioSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: true,
        trim: true
    },
    // Dato informativo. Ej: "Res. 1234/2020"
    resolucion: {
        type: String,
        default: '',
        trim: true
    },
    duracionAnios: {
        type: Number,
        default: 3,
        min: 1
    },
    // Un plan inactivo no se ofrece al crear cohortes nuevas, pero sigue existiendo para las cohortes ya creadas
    activo: {
        type: Boolean,
        default: true
    },
    // Meses que dura la regularidad: pasado ese tiempo desde que el alumno quedó Regular, pierde la posibilidad
    // de inscribirse al final y tiene que volver a cursar la materia. null = no vence por tiempo (rigen solo los llamados).
    vencimientoRegularidadMeses: {
        type: Number,
        default: 24,
        min: 1
    },
    // Llamados (turnos de final) que dura la cursada regular desde que se regularizó: al consumir el último
    // pierde la regularidad definitivamente y tiene que recursar. Un Desaprobado y un Ausente consumen llamado.
    // null = sin tope.
    maxLlamadosConsecutivos: {
        type: Number,
        default: 8,
        min: 1
    },
    // Máximo de "Ausente" a finales dentro de una misma cursada regular: al alcanzarlo pierde la regularidad.
    // null = sin tope (todavía sin confirmar con el instituto: se configura desde la pantalla del plan).
    maxAusentes: {
        type: Number,
        default: null,
        min: 1
    }
}, {
    timestamps: true
});

// ID numérico secuencial (mismo mecanismo que User). El "id" del contador tiene que ser único en todo el proyecto.
planEstudioSchema.plugin(AutoIncrement, { id: 'plan_estudio_id', inc_field: 'id' });
planEstudioSchema.index({ id: 1 }, { unique: true });

const PlanEstudio = mongoose.model('PlanEstudio', planEstudioSchema);

export default PlanEstudio;
