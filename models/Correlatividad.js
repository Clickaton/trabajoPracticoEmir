class Correlatividad {
    constructor(id, materia_id, requisito_id, tipo_requisito) {
        this.id = id;
        this.materia_id = materia_id;       // Ej: ID 4 (Diseño de Sistemas)
        this.requisito_id = requisito_id;   // Ej: ID 2 (Programación 1)
        this.tipo_requisito = tipo_requisito; // String: 'Regular' o 'Aprobada'
    }
}

module.exports = Correlatividad;