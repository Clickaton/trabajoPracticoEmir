class HistorialAcademico {
    constructor(id, alumno_id, materia_id, estado, nota = null) {
        this.id = id;
        this.alumno_id = alumno_id;
        this.materia_id = materia_id;
        this.estado = estado; // Solo aceptaremos: 'Cursando', 'Regular', o 'Aprobada'
        this.nota = nota; // Ej: 7, 8, 10 — null si todavía no tiene nota
    }
}

export default HistorialAcademico;