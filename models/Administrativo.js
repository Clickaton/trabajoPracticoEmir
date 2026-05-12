import User from './User.js';

// Aplicamos Herencia (extends) para que Administrativo herede las propiedades básicas de User (id, nombre, email, password).
class Administrativo extends User {
    constructor(id, name, email, password, rol, area) {
        // 'super' llama al constructor de la clase padre (User)
        super(id, name, email, password);

        // Propiedades únicas de un Administrativo
        this.rol = rol;   // Ej: 'SuperAdmin', 'Direccion'
        this.area = area; // Ej: 'Dirección Académica', 'Inscripciones'
    }
}

export default Administrativo;