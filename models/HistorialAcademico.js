import mongoose from 'mongoose';

const historialAcademicoSchema = new mongoose.Schema({
    id: { 
        type: Number, 
        required: true, 
        unique: true 
    },
    alumno_id: { 
        type: Number, 
        required: true 
    },
    materia_id: { 
        type: Number, 
        required: true 
    },
    estado: { 
        type: String, 
        required: true,
        enum: ['Cursando', 'Regular', 'Promocionada', 'Aprobada', 'Vencida'] // Validación estricta en la BD
    },
    nota: { 
        type: Number, 
        default: null 
    },

    // --- Campos agregados en la migración v2 (ver scripts/migrate-v2.js) ---
    // Número de cursada de la materia para el alumno. Si la regularidad vence y vuelve a cursar, se crea un registro
    // nuevo con intento + 1 y el anterior queda con vigente: false (así no se pierde el historial).
    intento: { type: Number, default: 1, min: 1 },
    // true = es el registro actual (último intento) de esa materia para ese alumno
    vigente: { type: Boolean, default: true },
    // Fecha en que el alumno quedó Regular. El vencimiento NO se guarda: se calcula como
    // fechaRegularizacion + vencimientoRegularidadMeses del plan, así respeta los cambios de configuración.
    fechaRegularizacion: { type: Date, default: null },
    // Por qué perdió la regularidad (solo para estado 'Vencida')
    motivoVencimiento: { type: String, enum: ['Tiempo', 'Llamados', 'Ausentes', 'Manual', null], default: null },
    // Acta de examen: ubicación física del libro y folio donde constan la firma y la nota
    libro: { type: String, default: '', trim: true },
    folio: { type: String, default: '', trim: true },
    fechaActa: { type: Date, default: null },
    // Al aprobar el final, `nota` pasa a ser la del final. Acá se guarda la nota que tenía la cursada
    // para poder restituirla si el resultado del final se corrige o se anula.
    notaCursada: { type: Number, default: null }
}, {
    timestamps: true
});

// Consulta frecuente: registro vigente de un alumno en una materia
historialAcademicoSchema.index({ alumno_id: 1, materia_id: 1, vigente: 1 });

const HistorialAcademico = mongoose.model('HistorialAcademico', historialAcademicoSchema);

export default HistorialAcademico;