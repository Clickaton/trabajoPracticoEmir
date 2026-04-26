const User = require('./User');

class Cohorte {
    constructor(id, name, startDate, endDate, materia, userList = []) {
        this.id = id;
        this.name = name;
        this.startDate = startDate;
        this.endDate = endDate;
        this.materia = materia;
        this.userList = userList;

        if (!Array.isArray(userList)) {
            throw new Error('userList debe ser un array de objetos User');
        }

        this.userList = userList;

    }
}

module.exports = Cohorte;