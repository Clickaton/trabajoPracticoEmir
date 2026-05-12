class PeriodoInscripcion {
    constructor(id, nombre, fechaInicio, fechaFin, activo = false) {
        this.id = id;
        this.nombre = nombre;           // Ej: "Primer Cuatrimestre 2026"
        this.fechaInicio = fechaInicio; // Objeto Date o String 'YYYY-MM-DD'
        this.fechaFin = fechaFin;       // Objeto Date o String 'YYYY-MM-DD'
        this.activo = activo;           // Booleano: true (abierto) o false (cerrado)
    }
}

module.exports = PeriodoInscripcion;