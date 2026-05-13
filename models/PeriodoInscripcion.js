class PeriodoInscripcion {
    constructor(id, nombre, fechaInicio, fechaFin, horaInicio, horaFin, activo = false) {
        this.id = id;
        this.nombre = nombre;           // Ej: "Marxo 2026"
        this.fechaInicio = fechaInicio; // String 'YYYY-MM-DD'
        this.fechaFin = fechaFin;       // String 'YYYY-MM-DD'
        this.horaInicio = horaInicio;   // String 'HH:MM' Ej: "08:00"
        this.horaFin = horaFin;         // String 'HH:MM' Ej: "20:00"
        this.activo = activo;           // true (abierto) o false (cerrado)
    }
}

export default PeriodoInscripcion;