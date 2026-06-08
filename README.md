# Sistema de Gestión Académica

API REST desarrollada con **Node.js** y **Express**, utilizando **ES6 Modules** y **async/await**. Los datos se persisten en archivos **JSON** locales. El sistema cuenta con dos módulos principales: **Administrativo** y **Estudiantes**.


---

## Tecnologías utilizadas

- Node.js
- Express
- ES6 Modules (`import/export`)
- `fs/promises` para lectura/escritura asíncrona de archivos
- Pug (motor de plantillas para vistas del módulo Administrativo)

---

## Instalación

```bash
npm install
node index.js
```

El servidor corre en `http://localhost:3000`

> Asegurate de tener `"type": "module"` en tu `package.json`

---

## Estructura del proyecto

```
├── Controllers/
│   ├── administrativoController.js
│   ├── alumnoController.js
│   ├── cohorteController.js
│   ├── correlatividadController.js
│   ├── estadoAcademicoController.js
│   ├── historialAcademicoController.js
│   ├── inscripcionController.js
│   ├── materiaController.js
│   ├── periodoInscripcionController.js
│   └── userController.js
├── data/
│   ├── administrativos.json
│   ├── alumnos.json
│   ├── cohortes.json
│   ├── correlatividades.json
│   ├── historialAcademico.json
│   ├── inscripciones.json
│   ├── materias.json
│   ├── periodosInscripcion.json
│   └── users.json
├── models/
│   ├── Administrativo.js
│   ├── Alumno.js
│   ├── Cohorte.js
│   ├── Correlatividad.js
│   ├── HistorialAcademico.js
│   ├── Inscripcion.js
│   ├── Materia.js
│   ├── PeriodoInscripcion.js
│   └── User.js
├── routes/
│   ├── administrativo.routes.js
│   ├── alumnoRoutes.js
│   ├── cohorteRoutes.js
│   ├── correlatividad.routes.js
│   ├── estadoAcademico.routes.js
│   ├── historialAcademico.routes.js
│   ├── inscripcion.routes.js
│   ├── materiaRoutes.js
│   ├── periodoInscripcion.routes.js
│   └── userRoutes.js
├── views/
│   └── administrativos/
│       ├── lista.pug
│       ├── registrar.pug
│       └── editar.pug
|        ...resto de carpetas para las vistas
└── index.js
```

---

## APIs Base (Core)

### Usuarios
Gestión básica de usuarios del sistema.

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/getUsers` | Obtener todos los usuarios |
| GET | `/getUserById/:id` | Obtener usuario por ID |
| POST | `/createUser` | Crear un usuario |
| PUT | `/updateUser/:id` | Actualizar un usuario |
| DELETE | `/deleteUser/:id` | Eliminar un usuario |

### Materias
CRUD básico del plan de estudios. Las materias están organizadas por año (1, 2 o 3) y son la base de todos los demás módulos.

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/materias` | Obtener todas las materias |
| GET | `/api/materias/:id` | Obtener materia por ID |
| POST | `/api/materias` | Crear una materia |
| PUT | `/api/materias/:id` | Actualizar una materia |
| DELETE | `/api/materias/:id` | Eliminar una materia |

---

## Módulo Administrativo

### Módulo 1: Administrativos
Gestión de los usuarios administrativos del sistema. Incluye vistas renderizadas con Pug para operar desde el navegador.

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/administrativos` | Listar administrativos (vista Pug) |
| GET | `/api/administrativos/nuevo` | Formulario de registro (vista Pug) |
| GET | `/api/administrativos/editar/:id` | Formulario de edición (vista Pug) |
| GET | `/api/administrativos/:id` | Obtener administrativo por ID |
| POST | `/api/administrativos` | Crear un administrativo |
| POST | `/api/administrativos/editar/:id` | Actualizar un administrativo |
| POST | `/api/administrativos/eliminar/:id` | Eliminar un administrativo |

**Modelo:** hereda de `User` y agrega `rol` y `area`.
**Persistencia:** `data/administrativos.json`

---

### Módulo 2: Habilitar Inscripciones (Períodos)
El administrador puede abrir o cerrar el período de inscripción. Sin un período activo, los alumnos no pueden inscribirse. Cada período tiene fecha de inicio, fecha de fin, hora de apertura y hora de cierre.

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/periodos-inscripcion` | Listar todos los períodos |
| GET | `/api/periodos-inscripcion/activos` | Listar solo los períodos activos |
| GET | `/api/periodos-inscripcion/:id` | Obtener período por ID |
| POST | `/api/periodos-inscripcion` | Crear un período |
| PUT | `/api/periodos-inscripcion/:id` | Actualizar un período (activar/desactivar) |
| DELETE | `/api/periodos-inscripcion/:id` | Eliminar un período |

**Modelo:** `PeriodoInscripcion(id, nombre, fechaInicio, fechaFin, horaInicio, horaFin, activo)`
**Persistencia:** `data/periodosInscripcion.json`

---

### Módulo 3: Reglas de Correlatividades
El administrador define qué materias necesita tener el alumno aprobada o regular para poder inscribirse a otra. Estas reglas son verificadas automáticamente al momento de la inscripción.

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/correlatividades` | Listar todas las reglas |
| GET | `/api/correlatividades/materia/:materiaId` | Obtener requisitos de una materia |
| GET | `/api/correlatividades/:id` | Obtener regla por ID |
| POST | `/api/correlatividades` | Crear una regla |
| PUT | `/api/correlatividades/:id` | Actualizar una regla |
| DELETE | `/api/correlatividades/:id` | Eliminar una regla |

**Modelo:** `Correlatividad(id, materia_id, requisito_id, tipo_requisito)`
donde `tipo_requisito` puede ser `"Regular"` o `"Aprobada"`.
**Persistencia:** `data/correlatividades.json`

---

### Módulo 4: Cohortes
El administrador organiza a los alumnos en cohortes por año lectivo. Cada cohorte tiene una lista de IDs de alumnos que se cruzan con `alumnos.json` para mostrar los datos completos.

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/getCohortes` | Listar todas las cohortes con alumnos |
| GET | `/getCohorteById/:id` | Obtener cohorte por ID |
| POST | `/crearCohorte` | Crear una cohorte |
| PUT | `/updateCohorte/:id` | Actualizar una cohorte |
| DELETE | `/deleteCohorte/:id` | Eliminar una cohorte |
| POST | `/cohorte/:cohorteId/addUser` | Agregar alumno a una cohorte |
| POST | `/cohorte/:cohorteId/removeUser` | Eliminar alumno de una cohorte |
| GET | `/cohorte/:cohorteId/users` | Listar alumnos de una cohorte |
| GET | `/cohorte/:cohorteId/duration` | Obtener duración en días de una cohorte |

**Modelo:** `Cohorte(id, name, startDate, endDate, userList)`
donde `userList` es un array de IDs de alumnos.
**Persistencia:** `data/cohortes.json`

---

## Módulo Estudiantes

### Alumnos
Gestión de los alumnos del sistema. El modelo hereda de `User` y agrega `legajo`, `activo` y `fecha_inscripcion`.

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/getAlumnos` | Listar todos los alumnos |
| GET | `/getAlumnoById/:id` | Obtener alumno por ID |
| POST | `/createAlumno` | Crear un alumno |
| PUT | `/updateAlumno/:id` | Actualizar un alumno |
| DELETE | `/deleteAlumno/:id` | Eliminar un alumno |

**Modelo:** hereda de `User` y agrega `legajo`, `activo` y `fecha_inscripcion`.
**Persistencia:** `data/alumnos.json`

---

### Módulo 1: Historial Académico
Registro de notas y estados de cada alumno por materia. El administrador carga y actualiza los registros. Los estados posibles son `Cursando`, `Regular` y `Aprobada`. Las materias sin registro se consideran `Pendiente`.

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/historial` | Listar todo el historial agrupado por alumno |
| GET | `/api/historial/alumno/:alumnoId` | Obtener historial de un alumno |
| POST | `/api/historial` | Crear un registro |
| PUT | `/api/historial/:id` | Actualizar estado y/o nota de un registro |

**Modelo:** `HistorialAcademico(id, alumno_id, materia_id, estado, nota)`
**Persistencia:** `data/historialAcademico.json`
**Conexiones:** cruza datos con `alumnos.json` y `materias.json`

---

### Módulo 2: Estado Académico
Endpoint consolidador de solo lectura. Devuelve todas las materias del plan de estudios con su estado calculado para un alumno en particular, incluyendo las materias `Pendiente` que no aparecen en el historial, y el porcentaje de carrera completado (calculado sobre materias Aprobadas).

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/estado-academico/:alumnoId` | Obtener estado académico completo del alumno |

**Ejemplo de respuesta:**
```json
{
    "alumno": "Sofia Diaz",
    "porcentaje_carrera": "67%",
    "materias": [
        { "nombre": "Análisis Matemático", "anio": 1, "estado": "Aprobada", "nota": 10 },
        { "nombre": "Inglés I",            "anio": 2, "estado": "Pendiente", "nota": null },
        { "nombre": "Inglés II",           "anio": 3, "estado": "Pendiente", "nota": null }
    ]
}
```

**Conexiones:** cruza datos con `materias.json` y `historialAcademico.json`

---

### Módulo 3: Inscripciones
Permite a los alumnos inscribirse a materias durante un período activo. El sistema verifica automáticamente las correlatividades antes de confirmar la inscripción. Al inscribirse exitosamente, se crea un registro `"Cursando"` en el historial académico. El alumno puede anular su inscripción siempre que el período siga activo.

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/inscripciones` | Listar todas las inscripciones agrupadas por cohorte y año |
| GET | `/api/inscripciones/alumno/:alumnoId` | Listar inscripciones de un alumno |
| POST | `/api/inscripciones` | Inscribir a un alumno en una materia |
| DELETE | `/api/inscripciones/:id` | Anular una inscripción |

**Modelo:** `Inscripcion(id, alumno_id, cohorte_id, materia_id, periodo_id, fecha)`
**Persistencia:** `data/inscripciones.json`
**Conexiones:** cruza datos con `alumnos.json`, `materias.json`, `cohortes.json`, `periodosInscripcion.json`, `correlatividades.json` y `historialAcademico.json`

**Verificaciones al inscribirse:**
1. Que exista un período de inscripción activo
2. Que el alumno exista en el sistema
3. Que el alumno cumpla todas las correlatividades de la materia
4. Que el alumno no esté ya inscripto a esa materia en el período activo

---

## Flujo completo del sistema

```
Admin abre período de inscripción
        ↓
Admin carga reglas de correlatividades
        ↓
Admin organiza alumnos en cohortes
        ↓
Alumno consulta su estado académico
        ↓
Sistema verifica correlatividades
        ↓
Alumno se inscribe → se crea registro "Cursando" en historial
        ↓
Admin carga notas → estado pasa a "Regular" o "Aprobada"
        ↓
Alumno consulta su progreso actualizado
```

---

## Conexiones entre módulos

| Módulo | Lee de |
|--------|--------|
| Correlatividades | `materias.json` |
| Cohortes | `alumnos.json` |
| Historial Académico | `alumnos.json`, `materias.json` |
| Estado Académico | `materias.json`, `historialAcademico.json` |
| Inscripciones | `alumnos.json`, `materias.json`, `cohortes.json`, `periodosInscripcion.json`, `correlatividades.json`, `historialAcademico.json` |