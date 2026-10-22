# Sistema de Gestión Institucional · ISFT N° 225

Aplicación web para la gestión académica del instituto: planes de estudio, cohortes, alumnos, correlatividades, inscripción a cursadas y a finales (con libro y folio), regularidad con vencimiento, constancias con código QR y un asistente virtual de soporte.

Tiene dos pantallas principales: el **panel administrativo** (cinco pestañas: Administración, Cohortes y Alumnos, Académico, Períodos de Inscripción y Correo) y el **dashboard del alumno**.

---

## Acceso para evaluadores

| | |
|---|---|
| **Usuario (email)** | `admin@admin.com` |
| **Contraseña** | `admin123` |
| **Rol** | Administrativo: acceso completo al panel |

Este usuario se crea solo la primera vez que arranca el servidor, si todavía no existe (función `crearDefaultAdminUser` en `index.js`). Con él se puede probar todo el sistema: crear planes de estudio, materias, correlatividades y cohortes, dar de alta alumnos, abrir períodos de inscripción y cargar resultados de finales con libro y folio.

Para ver la pantalla del alumno, creá un alumno desde la pestaña **Cohortes y Alumnos** del panel e ingresá con el email y la contraseña que le hayas puesto.

> Es una credencial de demostración para la evaluación académica. En un entorno real hay que cambiarla.

---

## Tecnologías

- Node.js 20 y Express 5, con ES Modules (`import/export`) y `async/await`
- MongoDB Atlas con Mongoose 8
- Pug para las vistas y Bootstrap 5 para el diseño
- Sesión con JWT en cookie (`jwtToken`) y contraseñas con bcrypt
- Socket.io para el chat con el asistente virtual (modelo local KoboldCpp, con respaldo en Gemini)
- Google OAuth y Google Sheets (una planilla por cohorte)
- pdfkit y qrcode para las constancias

---

## Puesta en marcha

```bash
npm install
npm start          # http://localhost:3000
npm test           # pruebas automáticas (node --test)
```

Variables de entorno (archivo `.env`, que no se sube al repositorio):

| Variable | Para qué sirve |
|----------|----------------|
| `MONGO_URI` | Conexión al clúster de MongoDB Atlas (obligatoria) |
| `JWT_SECRET` | Clave para firmar las sesiones (obligatoria) |
| `PORT` | Puerto del servidor (por defecto 3000; en Render lo asigna la plataforma) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Inicio de sesión con Google y acceso a Google Sheets |
| `APP_URL` | URL pública del sistema, usada en el código QR de las constancias (si falta, se usa `RENDER_EXTERNAL_URL`) |
| `KOBOLDCPP_BASE_URL`, `KOBOLDCPP_API_KEY`, `KOBOLDCPP_MODEL` | Modelo de lenguaje del asistente virtual |
| `GEMINI_API_KEY` (o `GEMINI_APIKEY`) | Respaldo del asistente cuando el modelo local no responde |

> En un hosting de producción agregá también `TZ = America/Argentina/Buenos_Aires` para que los servidores usen la misma zona horaria que el reloj local (los períodos de inscripción se controlan por fecha y hora).

### Si el asistente virtual responde «tuve un problema»

El asistente prueba primero KoboldCpp (`KOBOLDCPP_BASE_URL`) y, si no responde, Gemini (`gemini-2.5-flash` y, si ese está saturado, `gemini-2.5-flash-lite`). Si KoboldCpp falla, durante un minuto se lo deja para el final para no demorar cada pregunta. Si no responde ninguno, el chat muestra el aviso y la terminal del servidor cuenta por qué, en una línea que empieza con `Error en el flujo del asistente: Error: Ningún proveedor de IA respondió.`:

| Lo que dice la línea | Qué pasó | Qué hacer |
|----------------------|----------|-----------|
| `KoboldCpp (…): fetch failed (ECONNREFUSED)`, `(ETIMEDOUT)` o `(UND_ERR_CONNECT_TIMEOUT)` | El equipo que corre KoboldCpp está apagado, cambió de IP o está en otra red | Encenderlo y revisar la IP en `KOBOLDCPP_BASE_URL` |
| `Gemini (…): … [503 …]` | Google tiene el modelo saturado; suele pasar solo | Reintentar en unos minutos |
| `Gemini (…): … [429 …]` | Se agotó la cuota de la clave | Esperar o usar otra clave |
| `Gemini (…): … [400 …]` o `[403 …]` | La clave es inválida o fue deshabilitada | Crear una clave nueva en Google AI Studio y actualizarla en `.env` |

Después de cambiar el código o el `.env`, reiniciá el servidor (`Ctrl+C` y `npm start`): Node no recarga los archivos solo y un servidor que quedó abierto sigue respondiendo con el código anterior.

### Scripts de mantenimiento

| Comando | Qué hace |
|---------|----------|
| `node scripts/migrate-v2.js` | Simulación: informa qué cambiaría la migración a planes de estudio, finales y reglas de regularidad, sin escribir nada |
| `node scripts/migrate-v2.js --apply` | Aplica la migración (es idempotente) y antes guarda un respaldo en `backups/` |
| `node scripts/migrate-passwords.js` | Encripta con bcrypt las contraseñas que hubieran quedado en texto plano |
| `node scripts/normalizeRoles.js` | Normaliza el campo de rol de los usuarios existentes |

---

## Roles

| Rol | Qué puede hacer |
|-----|-----------------|
| Administrativo, Direccion, Secretario | Gestionan todo el panel: usuarios, planes, materias, cohortes, alumnos, períodos, historial y finales |
| Profesor | Consulta datos mediante la API; no modifica nada. Todavía no tiene una pantalla propia: al iniciar sesión ve un aviso que lo explica |
| Bibliotecario | Puede iniciar sesión, pero no tiene pantallas habilitadas: ve el mismo aviso |
| Alumno | Ve su dashboard, se inscribe a cursadas y a finales, genera constancias y edita su perfil (solo nombre, email y contraseña) |

Los permisos se controlan en `middlewares/authHybrid.js`.

---

## Reglas académicas

- **Planes de estudio:** pueden coexistir varios. Cada cohorte y cada materia pertenece a un plan, que define la duración en años, el vencimiento de la regularidad (en meses), el máximo de llamados consecutivos y el máximo de ausentes.
- **Correlatividades:** se definen entre materias del mismo plan y exigen que el requisito esté Regular o Aprobado.
- **Inscripción a cursada:** solo dentro de un período de tipo *Cursada* abierto. Se ofrecen únicamente las materias que el alumno puede cursar hoy; si perdió la regularidad, puede recursar (se registra el número de intento).
- **Inscripción a final:** solo dentro de un período de tipo *Final*. El personal carga el resultado junto con el **libro y el folio** del acta.
- **Semáforo:** estado de cada alumno según su avance y regularidad, también resumido por cohorte.
- **Ingreso y pase:** cada alumno registra su tipo de ingreso y, si viene de otro instituto, los datos del pase. Solo el personal puede modificarlos.
- **Constancias:** se generan en PDF con código QR y se validan públicamente en `/validar/:codigo`.

---

## Seguridad

- Las contraseñas se guardan con bcrypt y **el hash nunca sale del servidor**. Al editar un usuario, dejar la contraseña vacía conserva la actual.
- El alumno solo puede cambiar su nombre, email y contraseña. DNI, legajo, estado activo, fecha de inscripción, cohorte, tipo de ingreso y pase los carga el personal; si un alumno los envía, el servidor los ignora.
- El email es único en todo el sistema (sin distinguir mayúsculas) para que dos cuentas no puedan quedar bloqueadas por tener el mismo.
- El chat exige sesión iniciada: quién escribe se toma de la cookie y no de lo que mande el navegador. Cada respuesta le llega solo a quien preguntó, los mensajes se muestran como texto (nunca como HTML) y tienen un largo máximo.
- Al navegador solo llegan los datos públicos del usuario (nunca el hash ni los tokens de Google).
- **Errores:** las rutas de API y las llamadas `fetch` reciben JSON `{ error, status }`; la navegación normal recibe la página de error del sistema.
- **Borrado protegido:** una materia con historial, inscripciones, finales o correlatividades no se puede eliminar y responde `409` con el detalle de lo que la usa.

---

## Estructura del proyecto

```
├── index.js                  Servidor: sesión, rutas, chat y manejo de errores
├── Controllers/              Lógica de cada pantalla y recurso
├── models/                   Esquemas de Mongoose (User, Alumno, Administrativo, PlanEstudio, Materia, Cohorte, ...)
├── routes/                   Rutas de Express
├── middlewares/
│   ├── authHybrid.js         Sesión y permisos por rol
│   └── errorHandler.js       404 y errores (JSON o página, según quién pide)
├── services/
│   ├── reglasAcademicasService.js     Reglas de cursada, regularidad, finales y semáforo
│   ├── contextoAcademicoService.js    Datos académicos de un alumno para aplicar las reglas
│   ├── usuarioService.js              Email único y contraseñas
│   ├── chatService.js                 Chat en tiempo real con el asistente
│   ├── geminiService.js               Consulta al modelo de lenguaje
│   ├── respaldoIA.js                  Prueba KoboldCpp y, si falla, Gemini (con pausa para el que falló y causa de cada fallo)
│   └── googleSheetsService.js         Planilla de cada cohorte
├── utils/                    Fechas, orden de materias, ingreso/pase, ids correlativos
├── prompts/asistente.txt     Instrucciones del asistente virtual
├── views/
│   ├── administrativos/      Panel (index.pug + una carpeta tabs/ con cada pestaña y sus scripts)
│   ├── alumnos/dashboard.pug Dashboard del alumno
│   ├── partials/             Piezas compartidas (scripts comunes, chat)
│   └── mixins/               Componentes de Pug reutilizables
├── scripts/                  Migraciones y mantenimiento
└── tests/                    Pruebas automáticas (npm test)
```

---

## Referencia de endpoints

### Sesión y usuarios

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/login`, `/logout` | Pantalla de ingreso y cierre de sesión |
| POST | `/login` | Iniciar sesión con email y contraseña |
| GET | `/auth/google`, `/auth/google/callback` | Iniciar sesión con Google |
| GET | `/dashboard` | Dashboard del alumno |
| GET | `/getUsers`, `/getUserById/:id` | Listar usuarios / ver uno |
| POST | `/createUser`, `/updateUser/:id`, `/deleteUser/:id` | Alta, edición y baja de usuarios (solo personal administrativo) |

### Alumnos y cohortes

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/getAlumnos`, `/getAlumnoById/:id` | Listar alumnos / ver la ficha de uno |
| POST | `/createAlumno` | Alta de alumno (incluye tipo de ingreso y pase) |
| PUT | `/updateAlumno/:id` | Editar un alumno (el propio alumno: solo nombre, email y contraseña) |
| DELETE | `/deleteAlumno/:id` | Eliminar un alumno |
| GET | `/getCohortes`, `/getCohorteById/:id` | Listar cohortes / ver una |
| POST | `/crearCohorte` | Crear una cohorte (se vincula a un plan) |
| PUT / DELETE | `/updateCohorte/:id`, `/deleteCohorte/:id` | Editar o eliminar una cohorte |
| POST | `/cohorte/:cohorteId/addUser`, `/cohorte/:cohorteId/removeUser` | Agregar o quitar un alumno de la cohorte |
| GET | `/cohorte/:cohorteId/users`, `/cohorte/:cohorteId/duration` | Alumnos de la cohorte y duración en días |
| GET | `/api/sheets/abrir-cohorte/:cohorteId` | Abrir (o crear) la planilla de la cohorte en Google Sheets |
| GET | `/api/sheets/sync/:cohorteId` | Traer a la base los cambios hechos en la planilla; informa lo que no pudo aplicar |

### Plan de estudios

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET / POST | `/api/planes` | Listar planes / crear uno |
| GET / PUT / DELETE | `/api/planes/:id` | Ver, editar o eliminar un plan (solo si no tiene materias ni cohortes) |
| GET / POST | `/api/materias` | Listar materias / crear una |
| GET / PUT / DELETE | `/api/materias/:id` | Ver, editar o eliminar una materia (`409` si algo la usa) |
| GET / POST | `/api/correlatividades` | Listar reglas / crear una |
| GET | `/api/correlatividades/materia/:materiaId` | Requisitos de una materia |
| GET / PUT / DELETE | `/api/correlatividades/:id` | Ver, editar o quitar una regla |

### Períodos e inscripciones

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/periodos-inscripcion`, `/api/periodos-inscripcion/activos` | Todos los períodos / solo los vigentes |
| POST | `/api/periodos-inscripcion` | Crear un período (de Cursada o de Final) |
| GET / PUT / DELETE | `/api/periodos-inscripcion/:id` | Ver, editar o eliminar un período |
| GET | `/api/inscripciones` | Inscripciones a cursada de todas las cohortes (solo personal) |
| GET | `/api/inscripciones/alumno/:alumnoId` | Inscripciones de un alumno |
| POST | `/api/inscripciones` | Inscribirse a una cursada (aplica correlatividades y regularidad) |
| DELETE | `/api/inscripciones/:id` | Anular una inscripción dentro del plazo |
| GET | `/api/inscripciones-final/disponibles/:alumnoId` | Finales a los que el alumno puede anotarse |
| GET | `/api/inscripciones-final/alumno/:alumnoId`, `/api/inscripciones-final/periodo/:periodoId` | Finales de un alumno / de un período |
| POST | `/api/inscripciones-final` | Anotarse a un final |
| PUT | `/api/inscripciones-final/:id/resultado` | Cargar nota, libro y folio (solo personal) |
| DELETE | `/api/inscripciones-final/:id` | Darse de baja de un final |

### Historial, estado académico y constancias

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/historial`, `/api/historial/alumno/:alumnoId` | Historial académico global / de un alumno |
| POST / PUT / DELETE | `/api/historial`, `/api/historial/:id` | Cargar, corregir o eliminar un registro |
| GET | `/api/estado-academico/:alumnoId` | Avance de carrera y estado de cada materia |
| GET | `/api/estado-academico/cohorte/:cohorteId/semaforo` | Semáforo de los alumnos de una cohorte |
| POST | `/api/constancias/generar`, `/api/constancias/generar-porcentaje` | Generar una constancia en PDF |
| GET | `/api/constancias/mis-solicitudes` | Constancias ya generadas por el alumno |
| GET | `/validar/:codigo` | Validación pública de una constancia (sin iniciar sesión) |

### Administrativos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/administrativos` | Panel administrativo |
| GET | `/api/administrativos/:id` | Ver un administrativo |
| POST | `/api/administrativos` | Dar de alta a un administrativo |
| POST | `/api/administrativos/editar/:id` | Editar un administrativo |
| POST | `/api/administrativos/eliminar/:id` | Eliminar un administrativo |
| PUT | `/api/administrativos/updateAlumnoAdm/:id` | Editar un alumno desde el panel (el personal puede cambiar todos los datos) |

---

## Pruebas

`npm test` ejecuta las pruebas automáticas de `tests/`: reglas académicas, tipo de ingreso y pase, usuarios y contraseñas, manejo de errores y chat.
