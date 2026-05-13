class Inscripcion {
    constructor(id, alumno_id, cohorte_id, materia_id, periodo_id, fecha = new Date().toISOString()) {
        this.id = id;
        this.alumno_id = alumno_id;
        this.cohorte_id = cohorte_id;   // Referencia a la cohorte del alumno
        this.materia_id = materia_id;
        this.periodo_id = periodo_id;   // Referencia al período activo
        this.fecha = fecha;             // Fecha y hora exacta. Ej: "2026-03-05T14:30:00.0000Z"
    }
}

export default Inscripcion;