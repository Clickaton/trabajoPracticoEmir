import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
    // El email de la Secretaria o Dirección que hizo el cambio
    usuario: { 
        type: String, 
        required: true 
    },
    // Para saber si lo editaron desde tu sistema web o directamente desde Google Sheets
    origen: { 
        type: String, 
        required: true,
        enum: ['Web', 'Google Sheets'] 
    },
    // En qué planilla o tabla estaban (Ej: "Alumnos 2024")
    tabla: { 
        type: String, 
        required: true 
    },
    // El DNI o Legajo del alumno al que le modificaron los datos
    registro_id: { 
        type: String, 
        required: true 
    },
    // Qué columna tocaron (Ej: "teléfono" o "estado")
    campoModificado: { 
        type: String, 
        required: true 
    },
    // Qué decía antes de que lo toquen
    valorAnterior: { 
        type: String 
    },
    // Qué escribieron nuevo
    valorNuevo: { 
        type: String 
    }
}, {
    timestamps: true // Esto inyecta createdAt (cuándo se editó) y updatedAt automáticamente
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;