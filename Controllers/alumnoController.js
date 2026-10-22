import Alumno from '../models/Alumno.js';
import Cohorte from '../models/Cohorte.js'; // IMPORTANTE: Agregamos el modelo Cohorte para poder limpiarlo
import { actualizarAlumnoEnPlanilla } from '../services/googleSheetsService.js';
import PeriodoInscripcion from '../models/PeriodoInscripcion.js';
import { parseLocalDate, parseLocalDateTime } from '../utils/dateUtils.js';
import { validarDatosIngreso, traeDatosDeIngreso } from '../utils/ingresoAlumno.js';
import { ROLES_ADMINISTRATIVOS } from '../middlewares/authHybrid.js';
import { cargarContextoAcademico } from '../services/contextoAcademicoService.js';
import { evaluarInscripcionCursada } from '../services/reglasAcademicasService.js';
import { tipoDePeriodo } from '../utils/periodoUtils.js';
import { contraseniaNueva, normalizarEmail, emailValido, emailEnUso, CAMPOS_SOLO_PERSONAL } from '../services/usuarioService.js';


// Helper: quita la contraseña antes de devolver el JSON
const omitPassword = (alumno) => {
    const alumnoObj = alumno.toObject(); 
    const { password, ...alumnoSinPassword } = alumnoObj;
    return alumnoSinPassword;
};

export const getAlumnos = async (req, res, next) => {
    try {
        const listaAlumnos = await Alumno.find();
        const alumnosSinPassword = listaAlumnos.map(omitPassword);
        
        res.json({ message: 'Lista de alumnos', data: alumnosSinPassword });
    } catch (error) {
        next(error);
    }
};

export const getAlumnoById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const alumno = await Alumno.findOne({ id: parseInt(id) });
        
        if (!alumno) {
            const error = new Error('Alumno no encontrado');
            error.status = 404;
            return next(error);
        }
        
        res.json({ message: `Detalles del alumno con ID: ${id}`, data: omitPassword(alumno) });
    } catch (error) {
        next(error);
    }
};

export const getDashboard = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user || user.tipoPerfil !== 'Alumno') {
            return res.redirect('/login');
        }

        const alumno = await Alumno.findOne({ id: parseInt(user.id) });
        if (!alumno) {
            const error = new Error('Alumno no encontrado');
            error.status = 404;
            return next(error);
        }

        const ahora = new Date();
        const periodosActivos = await PeriodoInscripcion.find({ activo: true }).lean();

        // Solo los períodos de CURSADA habilitan la lista de materias (los de Final son otra pestaña)
        const periodoActivo = periodosActivos.filter(periodo => tipoDePeriodo(periodo) === 'Cursada').find(periodo => {
            const inicio = parseLocalDateTime(periodo.fechaInicio, periodo.horaInicio);
            const fin = parseLocalDateTime(periodo.fechaFin, periodo.horaFin);

            if (!inicio || !fin) return false;

            return ahora >= inicio && ahora <= fin;
        });

        let materiasDisponibles = [];

        if (periodoActivo) {
            // Solo las materias del plan de su cohorte (ordenadas por año y nombre) que hoy puede cursar:
            // se ocultan las aprobadas o promocionadas, las que ya está cursando y las Regulares vigentes
            // (esas se rinden en la inscripción a finales). Si perdió la regularidad, la materia vuelve a aparecer
            // para recursarla (con la marca `recursada`, y el intento que sería).
            const { materias, ctx } = await cargarContextoAcademico(alumno, { ahora });
            materiasDisponibles = materias
                .map(materia => ({ materia, evaluacion: evaluarInscripcionCursada(materia.id, ctx) }))
                .filter(({ evaluacion }) => evaluacion.bloqueo === null)
                .map(({ materia, evaluacion }) => ({
                    id: materia.id,
                    nombre: materia.nombre,
                    anio: materia.anio,
                    recursada: evaluacion.recursada,
                    proximoIntento: evaluacion.proximoIntento
                }));
        }

        // Para mostrar el nombre de la cohorte (y no solo su número) en la pantalla del alumno
        const cohorte = alumno.cohorte_id ? await Cohorte.findOne({ id: alumno.cohorte_id }).lean() : null;

        res.render('alumnos/dashboard', {
            alumno: omitPassword(alumno),
            cohorte,
            materias: materiasDisponibles,
            periodoCursada: periodoActivo ? { nombre: periodoActivo.nombre, fechaFin: periodoActivo.fechaFin, horaFin: periodoActivo.horaFin } : null
        });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const createAlumno = async (req, res, next) => {
    try {
        const { dni, password, activo, fecha_inscripcion, cohorte_id } = req.body;
        const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
        const email = normalizarEmail(req.body.email);
        const legajo = typeof req.body.legajo === 'string' ? req.body.legajo.trim() : req.body.legajo;

        if (!dni || !name || !email || !contraseniaNueva(password) || !legajo || activo === undefined || !fecha_inscripcion) {
            return res.status(400).json({ error: 'Faltan datos obligatorios' });
        }
        if (!emailValido(email)) return res.status(400).json({ error: 'El email no tiene un formato válido' });
        if (await emailEnUso(email)) return res.status(409).json({ error: 'Ese email ya lo usa otra cuenta' });

        // Datos de ingreso (informativos): con qué situación ingresó y si viene por pase de otro instituto
        const { datos: ingreso, error: errorIngreso } = validarDatosIngreso(req.body);
        if (errorIngreso) return res.status(400).json({ error: errorIngreso });

        // 1. Verificamos que la cohorte exista ANTES de crear nada
        let cohorteDestino = null;
        if (cohorte_id) {
            cohorteDestino = await Cohorte.findOne({ id: parseInt(cohorte_id) });
            if (!cohorteDestino) {
                return res.status(400).json({ error: 'La cohorte seleccionada no existe en la base de datos' });
            }
        }

        // 2. Creamos al alumno
        const nuevoAlumno = await Alumno.create({
            dni,
            name,
            email,
            password,
            legajo,
            activo,
            fecha_inscripcion: parseLocalDate(fecha_inscripcion),
            cohorte_id: cohorteDestino ? cohorteDestino.id : null, // Asignamos el ID de cohorte
            ...ingreso // tipoIngreso y pase (si no vienen, rigen los valores por defecto: Inicial y sin pase)
        });

        // 3. Si venía con cohorte, lo metemos en el array de esa cohorte automáticamente
        if (cohorteDestino) {
            cohorteDestino.userList.push(nuevoAlumno.id);
            await cohorteDestino.save();
        }

        res.status(201).json({ message: 'Alumno creado exitosamente', data: omitPassword(nuevoAlumno) });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: 'El DNI o el Legajo ya existen en la base de datos' });
        }
        next(error);
    }
};

// Edición de un alumno. Lo usan dos tipos de personas, con permisos distintos:
//  - el propio alumno (desde "Mi Perfil"): solo nombre, email y contraseña. DNI, legajo, estado activo y fecha de
//    inscripción son datos institucionales: si llegan en el pedido se ignoran (y se avisa en `camposIgnorados`).
//  - el personal administrativo: todos los campos, además del tipo de ingreso y el pase.
// En ambos casos, una contraseña vacía conserva la actual.
export const updateAlumno = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { dni, password, legajo, activo, fecha_inscripcion } = req.body;
        const esPersonal = ROLES_ADMINISTRATIVOS.includes(String(req.user?.rol ?? req.user?.role ?? '').trim());

        const datosAActualizar = {};

        // --- Datos de la cuenta (los puede cambiar el propio alumno) ---
        const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
        if (name) datosAActualizar.name = name;

        const email = normalizarEmail(req.body.email);
        if (email) {
            if (!emailValido(email)) return res.status(400).json({ error: 'El email no tiene un formato válido' });
            if (await emailEnUso(email, id)) return res.status(409).json({ error: 'Ese email ya lo usa otra cuenta' });
            datosAActualizar.email = email;
        }

        const passwordNueva = contraseniaNueva(password);
        if (passwordNueva) datosAActualizar.password = passwordNueva;

        // --- Datos institucionales (solo el personal administrativo) ---
        const camposIgnorados = [];
        if (esPersonal) {
            if (dni) datosAActualizar.dni = dni;
            if (legajo) datosAActualizar.legajo = legajo;
            if (activo !== undefined) datosAActualizar.activo = activo;
            if (fecha_inscripcion) datosAActualizar.fecha_inscripcion = parseLocalDate(fecha_inscripcion);
        } else {
            camposIgnorados.push(...CAMPOS_SOLO_PERSONAL.filter((campo) => req.body[campo] !== undefined));
        }

        // Tipo de ingreso y pase: los carga el personal administrativo (un alumno no puede cambiar cómo ingresó)
        if (traeDatosDeIngreso(req.body)) {
            if (!esPersonal) {
                return res.status(403).json({ error: 'Solo el personal administrativo puede modificar el tipo de ingreso o el pase' });
            }

            const actual = await Alumno.findOne({ id: parseInt(id) }).lean();
            if (!actual) return res.status(404).json({ error: 'Alumno no encontrado' });

            const { datos: ingreso, error: errorIngreso } = validarDatosIngreso(req.body, { actual });
            if (errorIngreso) return res.status(400).json({ error: errorIngreso });
            Object.assign(datosAActualizar, ingreso);
        }

        const alumnoActualizado = await Alumno.findOneAndUpdate(
            { id: parseInt(id) },
            datosAActualizar,
            { new: true }
        );

        if (!alumnoActualizado) {
            return res.status(404).json({ error: 'Alumno no encontrado' });
        }

        // Empujar los cambios a la planilla de Google Sheets de la cohorte (solo si quien edita tiene Google vinculado)
        if (alumnoActualizado.cohorte_id && req.user?.googleTokens) {
            try {
                const cohorte = await Cohorte.findOne({ id: alumnoActualizado.cohorte_id });
                if (cohorte?.spreadsheetId) {
                    await actualizarAlumnoEnPlanilla(cohorte.spreadsheetId, req.user.googleTokens, alumnoActualizado);
                }
            } catch (errorSheets) {
                console.error('Aviso: no se pudo actualizar Google Sheets:', errorSheets.message);
            }
        }

        const respuesta = { message: 'Alumno actualizado', data: omitPassword(alumnoActualizado) };
        if (camposIgnorados.length > 0) respuesta.camposIgnorados = camposIgnorados;
        res.json(respuesta);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: 'El DNI o el Legajo ya existen en la base de datos' });
        }
        next(error);
    }
};

export const deleteAlumno = async (req, res, next) => {
    try {
        const { id } = req.params;
        const alumnoIdNumerico = parseInt(id);

        // 1. Borramos al alumno
        const alumnoEliminado = await Alumno.findOneAndDelete({ id: alumnoIdNumerico });
        
        if (!alumnoEliminado) {
            const error = new Error('Alumno no encontrado');
            error.status = 400;
            return next(error);
        }

        // 2. CAZAFANTASMAS: Buscamos cualquier cohorte que tenga a este alumno y lo borramos de su array
        await Cohorte.updateMany(
            { userList: alumnoIdNumerico }, // Condición: si el ID está en la lista
            { $pull: { userList: alumnoIdNumerico } } // Acción: sacarlo de la lista (pull)
        );

        res.json({ message: "Alumno eliminado limpiamente de todo el sistema", data: omitPassword(alumnoEliminado) });
    } catch (error) {
        next(error);
    }
};