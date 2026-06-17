# Sistema de Gestión Académica
### Migración a MongoDB Atlas

API REST desarrollada con Node.js, Express y Mongoose ODM, utilizando ES6 Modules y `async/await`. Los datos se persisten en una base de datos NoSQL en la nube a través de MongoDB Atlas, abandonando el esquema de archivos locales para permitir consultas transaccionales, indexación y validación nativa de esquemas.

El sistema cuenta con dos módulos principales: **Administrativo** y **Estudiantes**.

---

## Tecnologías utilizadas

- Node.js
- Express
- MongoDB Atlas
- Mongoose ODM
- ES6 Modules (`import/export`)
- Pug (motor de plantillas para vistas del módulo Administrativo)

---

## Instalación

```bash
npm install
node index.js
```

El servidor corre en `http://localhost:3000`

> **Configuración requerida:** Asegurate de tener tu archivo `.env` configurado con la variable `MONGO_URI` apuntando a tu clúster de Atlas. Para entornos de producción (hosting), recordá agregar la variable de entorno `TZ = America/Argentina/Buenos_Aires` para unificar el control de zonas horarias de los servidores con el reloj local.

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
│        ...resto de carpetas para las vistas
└── index.js
```

---

## APIs Base (Core)

### Usuarios

Gestión básica de usuarios del sistema persistidos en la base de datos distribuida.

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/getUsers` | Obtener todos los usuarios de la base de datos |
| GET | `/getUserById/:id` | Obtener usuario por ID incremental |
| POST | `/createUser` | Crear un usuario |
| PUT | `/updateUser/:id` | Actualizar un usuario |
| DELETE | `/deleteUser/:id` | Eliminar un usuario |

### Materias

CRUD básico del plan de estudios. Las materias están organizadas por año (1, 2 o 3) y actúan como documentos de referencia obligatorios para la estructura curricular de los demás componentes.

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/materias` | Obtener todas las materias cargadas |
| GET | `/api/materias/:id` | Obtener materia por ID específico |
| POST | `/api/materias` | Crear una materia (Soporta esquemas masivos de inserción) |
| PUT | `/api/materias/:id` | Actualizar una materia |
| DELETE | `/api/materias/:id` | Eliminar una materia |

---

## Módulo Administrativo

### Módulo 1: Administrativos

Gestión de los usuarios administrativos del sistema. Incluye vistas dinámicas renderizadas con Pug en el servidor para operar directo desde el navegador web.

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/administrativos` | Listar administrativos (vista Pug) |
| GET | `/api/administrativos/nuevo` | Formulario de registro (vista Pug) |
| GET | `/api/administrativos/editar/:id` | Formulario de edición (vista Pug) |
| GET | `/api/administrativos/:id` | Obtener administrativo por ID |
| POST | `/api/administrativos` | Crear un administrativo |
| POST | `/api/administrativos/editar/:id` | Actualizar un administrativo |
| POST | `/api/administrativos/eliminar/:id` | Eliminar un administrativo |

- **Modelo:** Hereda del esquema base de `User` agregando de forma nativa las propiedades `rol` y `area`.
- **Persistencia:** Colección `administrativos` en MongoDB Atlas.

---

### Módulo 2: Habilitar Inscripciones (Períodos)

El administrador configura las ventanas de tiempo habilitadas para el alumnado. Incorpora una lógica de **Validación Dinámica de Tiempo**: al solicitar los períodos activos, el backend intercepta el reloj real del servidor (`new Date()`) y lo contrasta contra los parámetros límite del documento de configuración. Si el plazo expiró, las inscripciones se bloquean de manera automática aunque el indicador de estado marque un encendido manual.

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/periodos-inscripcion` | Listar la totalidad histórica de períodos |
| GET | `/api/periodos-inscripcion/activos` | Filtrar solo los períodos temporalmente vigentes |
| GET | `/api/periodos-inscripcion/:id` | Obtener un período por su identificador |
| POST | `/api/periodos-inscripcion` | Crear un período (Acepta cargas de registros masivos) |
| PUT | `/api/periodos-inscripcion/:id` | Modificar parámetros temporales o activar/desactivar |
| DELETE | `/api/periodos-inscripcion/:id` | Eliminar un registro de período de la colección |

- **Modelo:** `PeriodoInscripcion(id, nombre, fechaInicio, fechaFin, horaInicio, horaFin, activo)`
- **Persistencia:** Colección `periodoinscripcions` en MongoDB Atlas.

---

### Módulo 3: Reglas de Correlatividades

Establece las dependencias académicas previas que condicionan el progreso estudiantil. El sistema procesa los cruzamientos en tiempo real antes de conceder accesos de inscripción automáticos.

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/correlatividades` | Listar todas las reglas de correlatividad vigentes |
| GET | `/api/correlatividades/materia/:materiaId` | Obtener los requisitos específicos de una asignatura |
| GET | `/api/correlatividades/:id` | Obtener una regla de correlatividad por ID |
| POST | `/api/correlatividades` | Crear una nueva regla académica |
| PUT | `/api/correlatividades/:id` | Actualizar una regla curricular |
| DELETE | `/api/correlatividades/:id` | Eliminar una regla de la base de datos |

- **Modelo:** `Correlatividad(id, materia_id, requisito_id, condicion)` donde `condicion` valida estrictamente los valores `"Regular"` o `"Aprobada"`.
- **Persistencia:** Colección `correlatividades` en MongoDB Atlas.

---

### Módulo 4: Cohortes

Agrupación lógica de alumnos organizada por año de ingreso lectivo. Realiza consultas indexadas a la colección de alumnos para inyectar datos de identidad completos sobre listas mapeadas.

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/getCohortes` | Listar todas las cohortes con sus respectivos alumnos cruzados |
| GET | `/getCohorteById/:id` | Obtener cohorte específica por ID |
| POST | `/crearCohorte` | Crear una cohorte lectiva |
| PUT | `/updateCohorte/:id` | Actualizar datos de una cohorte |
| DELETE | `/deleteCohorte/:id` | Eliminar una cohorte |
| POST | `/cohorte/:cohorteId/addUser` | Vincular un alumno al array interno de la cohorte |
| POST | `/cohorte/:cohorteId/removeUser` | Remover un alumno del array interno de la cohorte |
| GET | `/cohorte/:cohorteId/users` | Listar la nómina de alumnos pertenecientes a la cohorte |
| GET | `/cohorte/:cohorteId/duration` | Calcular la extensión total en días de la cohorte |

- **Modelo:** `Cohorte(id, name, startDate, endDate, userList)` donde `userList` almacena una matriz ordenada de identificadores numéricos de alumnos.
- **Persistencia:** Colección `cohortes` en MongoDB Atlas.

---

## Módulo Estudiantes

### Alumnos

Gestión centralizada del perfil de los estudiantes matriculados en la institución.

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/getAlumnos` | Listar la totalidad de alumnos del sistema |
| GET | `/getAlumnoById/:id` | Recuperar la ficha técnica de un alumno por ID |
| POST | `/createAlumno` | Dar de alta un alumno |
| PUT | `/updateAlumno/:id` | Actualizar datos del estudiante |
| DELETE | `/deleteAlumno/:id` | Eliminar de forma permanente un alumno de la colección |

- **Modelo:** Hereda del esquema base de `User`, expandiendo con propiedades para `legajo`, `activo` y `fecha_inscripcion`.
- **Persistencia:** Colección `alumnos` en MongoDB Atlas.

---

### Módulo 1: Historial Académico

Registro transaccional de las calificaciones y estados de avance de cada estudiante. Posee validación estricta de esquemas a través de un `enum` interno para blindar la consistencia de datos de notas. Admite carga unificada a través de arreglos nativos (`insertMany`). Las respuestas administrativas enriquecen la información inyectando de forma dinámica la pertenencia del alumno a su Cohorte de origen.

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/historial` | Obtener el historial agrupado globalmente, detallando alumnos y cohortes |
| GET | `/api/historial/alumno/:alumnoId` | Obtener la sábana de notas histórica y ordenada de un estudiante |
| POST | `/api/historial` | Crear registros de calificaciones (Acepta cargas masivas por lote) |
| PUT | `/api/historial/:id` | Modificar de forma puntual el estado o la nota de una cursada |

- **Modelo:** `HistorialAcademico(id, alumno_id, materia_id, estado, nota)` donde `estado` solo acepta de manera restrictiva: `'Cursando'`, `'Regular'` o `'Aprobada'`.
- **Persistencia:** Colección `historialacademicos` en MongoDB Atlas.
- **Conexiones:** Resuelve y cruza datos en caliente con las colecciones `alumnos`, `materias` y `cohortes`.

---

### Módulo 2: Estado Académico

Endpoint consolidador estratégico de **Solo Lectura**. No almacena información redundante en colecciones propias para evitar la desnormalización de datos. Intercepta de forma asíncrona la grilla oficial de materias de la carrera y superpone el historial particular del alumno, calculando el avance real y catalogando automáticamente los espacios vacíos bajo la etiqueta genérica de materias con estado `"Pendiente"` con nota `null`.

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/estado-academico/:alumnoId` | Obtener consolidación del estado académico y porcentaje de carrera |

**Ejemplo de respuesta calculada en tiempo real:**

```json
{
  "alumno": "Carlos Prueba",
  "porcentaje_carrera": "10%",
  "materias": [
    { "nombre": "Análisis Matemático", "anio": 1, "estado": "Aprobada", "nota": 9 },
    { "nombre": "Introducción a las redes de datos", "anio": 1, "estado": "Regular", "nota": null },
    { "nombre": "Inglés I", "anio": 2, "estado": "Cursando", "nota": null },
    { "nombre": "Sistemas Operativos", "anio": 1, "estado": "Pendiente", "nota": null }
  ]
}
```

- **Conexiones:** Ejecuta un proceso de unificación dinámica consumiendo los datos vivos de las colecciones `alumnos`, `materias` y `historialacademicos`.

---

### Módulo 3: Inscripciones

Constituye el núcleo operativo e inteligente de la API. Incorpora un mecanismo de **Auto-Incremento Secuencial Seguro** (`findOne().sort('-id')`) que consulta el identificador más alto emitido históricamente para asignar el ticket de entrada subsiguiente, evitando las superposiciones producidas al contar longitudes de arrays cuando existen cancelaciones intermedias.

Al ejecutarse exitosamente, acciona un mecanismo de **Doble Escritura Transaccional** abriendo en simultáneo el renglón correspondiente con estado `"Cursando"` en el Historial Académico del alumno.

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/inscripciones` | Mapear inscripciones globales agrupadas por cohortes y años curriculares |
| GET | `/api/inscripciones/alumno/:alumnoId` | Listar el registro de asignaturas donde se inscribió un alumno |
| POST | `/api/inscripciones` | Procesar solicitud de inscripción aplicando validaciones lógicas en cadena |
| DELETE | `/api/inscripciones/:id` | Anular inscripción y remover el estado del historial (Solo en plazos vigentes) |

- **Modelo:** `Inscripcion(id, alumno_id, cohorte_id, materia_id, periodo_id, fecha)`
- **Persistencia:** Colección `inscripcions` en MongoDB Atlas.
- **Conexiones:** Centraliza operaciones cruzando de forma simultánea `alumnos`, `materias`, `cohortes`, `periodoinscripcions`, `correlatividades` y `historialacademicos`.

#### Verificaciones de seguridad en cadena al inscribirse

1. **Validación Horaria Extrínseca:** Evalúa dinámicamente si el momento exacto del request se encuentra comprendido dentro de un período abierto y válido en la base de datos.
2. **Validación de Identidad:** Certifica que el estudiante peticionante posea una cuenta activa en la institución.
3. **Control de Prerrequisitos:** Examina el árbol de correlatividades asignado a la asignatura y audita el historial académico personal del estudiante para corroborar que la condición requerida (`'Regular'` o `'Aprobada'`) esté asentada.
4. **Protección contra Duplicaciones:** Verifica la inexistencia previa de transacciones análogas vigentes para el alumno en la misma materia durante la ventana temporal actual.

---

## Flujo completo del sistema

```
Administrador da de alta Período de Inscripción con plazos límite en Atlas
                                ↓
Administrador asienta las reglas estructurales de Correlatividades
                                ↓
Administrador agrupa y matricula los Alumnos en sus respectivas Cohortes
                                ↓
Estudiante consulta dinámicamente su Estado Académico (Vista procesada al vuelo)
                                ↓
Estudiante solicita Inscripción → El backend contrasta el reloj del servidor y correlatividades
                                ↓
Inscripción Autorizada → Escritura en cascada (Inscripción creada + Historial en "Cursando")
                                ↓
Administrador evalúa y califica → Estado transmuta nativamente a "Regular" o "Aprobada"
                                ↓
Estudiante visualiza su progreso recalculado e impacto inmediato en su porcentaje
```

---

## Conexiones entre módulos

| Módulo | Colecciones que consulta (Cruce de Datos en Atlas) |
|--------|----------------------------------------------------|
| Correlatividades | `materias` |
| Cohortes | `alumnos` |
| Historial Académico | `alumnos`, `materias`, `cohortes` |
| Estado Académico | `alumnos`, `materias`, `historialacademicos` |
| Inscripciones | `alumnos`, `materias`, `cohortes`, `periodoinscripcions`, `correlatividades`, `historialacademicos` |