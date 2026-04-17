const User = require('./User.js');

class Alumno extends User {
    constructor(id, name, email, password, legajo, activo, fecha_inscripcion) {
        super(id, name, email, password);

        this.legajo = legajo;
        this.activo = activo; 
        this.fecha_inscripcion = fecha_inscripcion; 
    }
}

module.exports = Alumno;