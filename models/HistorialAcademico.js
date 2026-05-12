class HistorialAcademico {
    constructor(id, alumno_id, materia_id, estado) {
        this.id = id;
        this.alumno_id = alumno_id;
        this.materia_id = materia_id;
        this.estado = estado; // Solo aceptaremos: 'Cursando', 'Regular', o 'Aprobada'
    }
}

module.exports = HistorialAcademico;