import mongoose from 'mongoose';
import mongooseSequence from 'mongoose-sequence';

const AutoIncrement = mongooseSequence(mongoose);

// Inscripción de un alumno a un final (mesa de examen). Cada documento es a la vez la inscripción y el registro
// del intento: cuando se rinde, se completan estado, nota, libro y folio del acta de examen.
// Se mantiene separada de Inscripcion (cursada) porque esa colección se limpia al regularizar la materia.
const inscripcionFinalSchema = new mongoose.Schema({
    alumno_id: {
        type: Number,
        required: true
    },
    cohorte_id: {
        type: Number,
        default: null
    },
    materia_id: {
        type: Number,
        required: true
    },
    // Período de inscripción de tipo 'Final' en el que se anotó
    periodo_id: {
        type: Number,
        required: true
    },
    // Registro de HistorialAcademico (la cursada) sobre el que se rinde este final
    historial_id: {
        type: Number,
        default: null
    },
    // Fecha en que el alumno se inscribió
    fecha: {
        type: Date,
        default: Date.now
    },
    estado: {
        type: String,
        enum: ['Inscripto', 'Aprobado', 'Desaprobado', 'Ausente', 'Anulada'],
        default: 'Inscripto'
    },
    nota: {
        type: Number,
        default: null,
        min: 1,
        max: 10
    },
    // Acta de examen: ubicación física del libro y folio donde constan la firma y la nota
    libro: {
        type: String,
        default: '',
        trim: true
    },
    folio: {
        type: String,
        default: '',
        trim: true
    },
    // Fecha en que se rindió
    fechaExamen: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// ID numérico secuencial atómico: importa porque muchos alumnos se anotan casi a la vez cuando abre el período.
inscripcionFinalSchema.plugin(AutoIncrement, { id: 'inscripcion_final_id', inc_field: 'id' });
inscripcionFinalSchema.index({ id: 1 }, { unique: true });

// Consultas frecuentes: intentos de un alumno en una materia / inscriptos de una mesa
inscripcionFinalSchema.index({ alumno_id: 1, materia_id: 1, estado: 1 });
inscripcionFinalSchema.index({ periodo_id: 1, materia_id: 1 });
// Un alumno no puede tener dos inscripciones abiertas a la misma materia (la base lo garantiza aunque lleguen dos pedidos a la vez)
inscripcionFinalSchema.index(
    { alumno_id: 1, materia_id: 1 },
    { unique: true, partialFilterExpression: { estado: 'Inscripto' } }
);

const InscripcionFinal = mongoose.model('InscripcionFinal', inscripcionFinalSchema);

export default InscripcionFinal;
