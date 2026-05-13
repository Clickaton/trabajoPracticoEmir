class Cohorte {
    constructor(id, name, startDate, endDate, userList = []) {
        this.id = id;
        this.name = name;
        this.startDate = startDate;
        this.endDate = endDate;

        if (!Array.isArray(userList)) {
            throw new Error('userList debe ser un array de IDs');
        }

        this.userList = userList;
    }
}

export default Cohorte;