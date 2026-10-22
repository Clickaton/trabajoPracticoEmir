/*
 * MIGRACIÓN v2 — Planes de estudio, inscripción a finales, tipo de ingreso/pase y reglas de regularidad.
 *
 * Qué hace (es idempotente: se puede ejecutar más de una vez sin duplicar nada):
 *   1. Crea un Plan de Estudios (si no existe ninguno) y se lo asigna a las materias y cohortes que no tengan plan_id.
 *   2. Marca los períodos de inscripción existentes como tipo 'Cursada'.
 *   3. Completa en HistorialAcademico: intento = 1, vigente = true, libro/folio vacíos y, para las materias en
 *      estado 'Regular', fechaRegularizacion = última modificación del registro (es una APROXIMACIÓN: se puede corregir a mano).
 *   4. Completa en los alumnos: tipoIngreso = 'Inicial' y pase vacío.
 *
 * Uso:
 *   node scripts/migrate-v2.js              SIMULACIÓN (modo por defecto): solo informa, no escribe nada en la base.
 *   node scripts/migrate-v2.js --apply      Aplica los cambios. Antes guarda un backup en la carpeta /backups.
 *
 * Opciones:
 *   --plan-id=2                Plan al que se asignan las materias/cohortes (obligatorio si ya existe más de un plan).
 *   --plan-nombre="Plan 2020"  Nombre del plan que se crea si todavía no existe ninguno.
 *   --meses=24                 Meses de vencimiento de regularidad del plan que se crea (también se usa en el informe).
 *   --aceptar-duplicados       Permite aplicar aunque haya historiales duplicados (alumno + materia). Quedan los dos como
 *                              intento 1 y vigentes: usar solo si se piensan resolver después.
 *   --ayuda                    Muestra esta ayuda.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// En simulación el script NO debe tocar la base. Por defecto mongoose crea colecciones e índices al conectar,
// así que se desactiva ANTES de cargar los modelos (por eso se importan de forma dinámica, después de este set).
mongoose.set('autoIndex', false);
mongoose.set('autoCreate', false);

const { default: PlanEstudio } = await import('../models/PlanEstudio.js');
const { default: Materia } = await import('../models/Materia.js');
const { default: Cohorte } = await import('../models/Cohorte.js');
const { default: PeriodoInscripcion } = await import('../models/PeriodoInscripcion.js');
const { default: HistorialAcademico } = await import('../models/HistorialAcademico.js');
const { default: Alumno } = await import('../models/Alumno.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Filtros de lo que falta migrar. Con { campo: null } Mongo matchea tanto null como campo inexistente.
const FILTROS = {
    materiasSinPlan: { plan_id: null },
    cohortesSinPlan: { plan_id: null },
    periodosSinTipo: { tipo: { $exists: false } },
    historialSinIntento: { intento: { $exists: false } },
    regularesSinFecha: { estado: 'Regular', fechaRegularizacion: null },
    alumnosSinIngreso: { tipoPerfil: 'Alumno', tipoIngreso: { $exists: false } },
    alumnosSinPase: { tipoPerfil: 'Alumno', pase: { $exists: false } }
};

const mostrarAyuda = () => {
    console.log(`
Uso:
  node scripts/migrate-v2.js              Simulación (no escribe nada)
  node scripts/migrate-v2.js --apply      Aplica la migración (antes hace backup en /backups)

Opciones:
  --plan-id=<id>             Plan destino (obligatorio si ya hay más de un plan)
  --plan-nombre="<nombre>"   Nombre del plan a crear si no existe ninguno (default: "Plan de Estudios vigente")
  --meses=<n>                Vencimiento de regularidad en meses del plan a crear (default: 24)
  --aceptar-duplicados       Aplica aunque haya historiales duplicados (no recomendado)
  --ayuda                    Muestra esta ayuda
`);
};

const parseArgs = (argv) => {
    const args = { apply: false, ayuda: false, aceptarDuplicados: false, planId: null, planNombre: 'Plan de Estudios vigente', meses: 24 };

    for (const a of argv) {
        if (a === '--apply') args.apply = true;
        else if (a === '--ayuda' || a === '--help') args.ayuda = true;
        else if (a === '--aceptar-duplicados') args.aceptarDuplicados = true;
        else if (a.startsWith('--plan-id=')) args.planId = parseInt(a.slice('--plan-id='.length), 10);
        else if (a.startsWith('--plan-nombre=')) args.planNombre = a.slice('--plan-nombre='.length).trim();
        else if (a.startsWith('--meses=')) args.meses = parseInt(a.slice('--meses='.length), 10);
        else {
            console.error(`Opción desconocida: ${a}\nUsá --ayuda para ver las opciones.`);
            process.exit(1);
        }
    }

    if (args.planId !== null && Number.isNaN(args.planId)) {
        console.error('--plan-id tiene que ser un número.');
        process.exit(1);
    }
    if (!Number.isInteger(args.meses) || args.meses < 1) {
        console.error('--meses tiene que ser un número entero mayor o igual a 1.');
        process.exit(1);
    }
    if (!args.planNombre) {
        console.error('--plan-nombre no puede estar vacío.');
        process.exit(1);
    }
    return args;
};

const fila = (texto, valor) => console.log(`  ${String(texto).padEnd(58)} ${valor}`);

const contarPendientes = async () => ({
    planes: await PlanEstudio.collection.countDocuments({}),
    materiasSinPlan: await Materia.collection.countDocuments(FILTROS.materiasSinPlan),
    cohortesSinPlan: await Cohorte.collection.countDocuments(FILTROS.cohortesSinPlan),
    periodosSinTipo: await PeriodoInscripcion.collection.countDocuments(FILTROS.periodosSinTipo),
    historialSinIntento: await HistorialAcademico.collection.countDocuments(FILTROS.historialSinIntento),
    regularesSinFecha: await HistorialAcademico.collection.countDocuments(FILTROS.regularesSinFecha),
    alumnosSinIngreso: await Alumno.collection.countDocuments(FILTROS.alumnosSinIngreso),
    alumnosSinPase: await Alumno.collection.countDocuments(FILTROS.alumnosSinPase)
});

// Cuántos alumnos están hoy en estado Regular y cuántos ya habrían vencido con la regla de N meses
const regularesVencidos = async (meses) => {
    const limite = new Date();
    limite.setMonth(limite.getMonth() - meses);

    const regulares = await HistorialAcademico.collection
        .find({ estado: 'Regular' }, { projection: { fechaRegularizacion: 1, updatedAt: 1, createdAt: 1 } })
        .toArray();

    const vencidos = regulares.filter(r => {
        const desde = r.fechaRegularizacion || r.updatedAt || r.createdAt;
        return desde && new Date(desde) < limite;
    }).length;

    return { total: regulares.length, vencidos };
};

// Alumno + materia con más de un registro de historial. Devuelve el detalle para poder revisarlos a mano:
// después de migrar, todos quedarían como intento 1 y vigentes, y eso es ambiguo.
const historialDuplicado = async () => {
    const grupos = await HistorialAcademico.collection.aggregate([
        { $group: { _id: { alumno_id: '$alumno_id', materia_id: '$materia_id' }, n: { $sum: 1 } } },
        { $match: { n: { $gt: 1 } } }
    ]).toArray();

    const detalle = [];
    for (const g of grupos) {
        const { alumno_id, materia_id } = g._id;
        const registros = await HistorialAcademico.collection
            .find({ alumno_id, materia_id }, { projection: { id: 1, estado: 1, nota: 1, createdAt: 1 } })
            .sort({ id: 1 })
            .toArray();
        const alumno = await Alumno.collection.findOne({ tipoPerfil: 'Alumno', id: alumno_id }, { projection: { name: 1, legajo: 1 } });
        const materia = await Materia.collection.findOne({ id: materia_id }, { projection: { nombre: 1 } });

        detalle.push({
            alumno_id,
            materia_id,
            alumno: alumno?.name ?? 'Alumno desconocido',
            legajo: alumno?.legajo ?? '-',
            materia: materia?.nombre ?? 'Materia desconocida',
            registros
        });
    }
    return detalle;
};

const resolverPlanDestino = async (args) => {
    if (args.planId !== null) {
        const plan = await PlanEstudio.findOne({ id: args.planId }).lean();
        if (!plan) throw new Error(`No existe un plan de estudios con id ${args.planId}.`);
        return { plan, crear: false };
    }

    const planes = await PlanEstudio.find().sort({ id: 1 }).lean();
    if (planes.length === 1) return { plan: planes[0], crear: false };
    if (planes.length === 0) return { plan: null, crear: true };

    throw new Error('Ya hay más de un plan de estudios: indicá cuál usar con --plan-id=<id>.');
};

const mostrarInforme = ({ pend, destino, args, reg, duplicados, mesesRef }) => {
    console.log('\n=== Estado actual de la base ===');
    fila('Planes de estudio existentes', pend.planes);
    if (destino.crear) fila('Plan que se crearía', `"${args.planNombre}" (regularidad: ${args.meses} meses)`);
    else if (destino.plan) fila('Plan destino', `#${destino.plan.id} "${destino.plan.nombre}"`);
    fila('Materias sin plan', pend.materiasSinPlan);
    fila('Cohortes sin plan', pend.cohortesSinPlan);
    fila('Períodos de inscripción sin tipo', pend.periodosSinTipo);
    fila('Registros de historial sin intento/vigente', pend.historialSinIntento);
    fila('Materias Regulares sin fecha de regularización', pend.regularesSinFecha);
    fila('Alumnos sin tipo de ingreso', pend.alumnosSinIngreso);
    fila('Alumnos sin datos de pase', pend.alumnosSinPase);

    console.log('\n=== A tener en cuenta ===');
    fila(`Regulares: ${reg.total}. Ya vencidos con ${mesesRef} meses`, reg.vencidos);
    fila('Alumno+materia con más de un registro de historial', duplicados.length);
    if (reg.vencidos > 0) {
        console.log(`  -> ${reg.vencidos} alumno(s) perderían hoy la chance de rendir final. Si no es lo que querés, ajustá --meses antes de aplicar.`);
    }
    if (duplicados.length > 0) {
        console.log('\n=== Historiales duplicados (alumno + materia) ===');
        for (const d of duplicados) {
            console.log(`  ${d.alumno} (id ${d.alumno_id}, legajo ${d.legajo}) - ${d.materia} (id ${d.materia_id})`);
            for (const r of d.registros) {
                const fecha = r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : 's/fecha';
                console.log(`      historial #${r.id}  ${String(r.estado).padEnd(9)} nota ${r.nota ?? '-'}  creado ${fecha}`);
            }
        }
        console.log('  -> Si uno es un registro de más (ej. un "Cursando" repetido), borralo desde la Ficha del alumno antes de aplicar.');
        console.log('     Si son dos cursadas reales de la misma materia, no los borres: consultalo antes de aplicar.');
    }
};

// Backup en JSON (formato Extended JSON, conserva fechas e _id). Los alumnos se guardan SIN contraseña.
const hacerBackup = async () => {
    const { EJSON } = mongoose.mongo.BSON;
    const marca = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = path.join(__dirname, '..', 'backups', `migrate-v2-${marca}`);
    fs.mkdirSync(dir, { recursive: true });

    const colecciones = [
        ['materias', Materia.collection, {}, {}],
        ['cohortes', Cohorte.collection, {}, {}],
        ['periodos-inscripcion', PeriodoInscripcion.collection, {}, {}],
        ['historial-academico', HistorialAcademico.collection, {}, {}],
        ['alumnos', Alumno.collection, { tipoPerfil: 'Alumno' }, { projection: { password: 0 } }]
    ];

    for (const [nombre, coleccion, filtro, opciones] of colecciones) {
        const docs = await coleccion.find(filtro, opciones).toArray();
        fs.writeFileSync(path.join(dir, `${nombre}.json`), EJSON.stringify(docs, undefined, 2), 'utf-8');
        fila(`Backup ${nombre}`, `${docs.length} documentos`);
    }
    return dir;
};

const aplicar = async ({ destino, args }) => {
    const informar = (nombre, r) => fila(nombre, `${r.modifiedCount} modificados`);

    let plan = destino.plan;
    if (destino.crear) {
        plan = await PlanEstudio.create({ nombre: args.planNombre, vencimientoRegularidadMeses: args.meses });
        fila('Plan creado', `#${plan.id} "${plan.nombre}"`);
    }

    // Se usa la colección nativa (no los modelos) para no tocar updatedAt ni disparar validaciones/hooks
    if (plan) {
        informar('Materias -> plan', await Materia.collection.updateMany(FILTROS.materiasSinPlan, { $set: { plan_id: plan.id } }));
        informar('Cohortes -> plan', await Cohorte.collection.updateMany(FILTROS.cohortesSinPlan, { $set: { plan_id: plan.id } }));
    }

    informar('Períodos -> tipo Cursada', await PeriodoInscripcion.collection.updateMany(
        FILTROS.periodosSinTipo,
        { $set: { tipo: 'Cursada', fechaExamen: null } }
    ));

    informar('Historial: intento/vigente/acta', await HistorialAcademico.collection.updateMany(
        FILTROS.historialSinIntento,
        { $set: { intento: 1, vigente: true, fechaRegularizacion: null, motivoVencimiento: null, libro: '', folio: '', fechaActa: null } }
    ));

    informar('Historial: fecha de regularización', await HistorialAcademico.collection.updateMany(
        FILTROS.regularesSinFecha,
        [{ $set: { fechaRegularizacion: { $ifNull: ['$updatedAt', '$createdAt'] } } }]
    ));

    informar('Alumnos -> tipo de ingreso Inicial', await Alumno.collection.updateMany(
        FILTROS.alumnosSinIngreso,
        { $set: { tipoIngreso: 'Inicial' } }
    ));

    informar('Alumnos -> pase vacío', await Alumno.collection.updateMany(
        FILTROS.alumnosSinPase,
        { $set: { pase: { esPase: false, institutoOrigen: '', fechaPase: null, observaciones: '' } } }
    ));
};

const main = async () => {
    const args = parseArgs(process.argv.slice(2));
    if (args.ayuda) {
        mostrarAyuda();
        return;
    }

    if (!process.env.MONGO_URI) {
        console.error('FATAL: Falta la variable de entorno MONGO_URI en el archivo .env');
        process.exit(1);
    }

    console.log(args.apply ? '*** MODO APLICAR: se van a modificar datos ***' : '*** MODO SIMULACIÓN: no se modifica nada ***');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Conectado a MongoDB.');

    try {
        const pend = await contarPendientes();
        const necesitaPlan = pend.materiasSinPlan + pend.cohortesSinPlan > 0;
        const destino = necesitaPlan ? await resolverPlanDestino(args) : { plan: null, crear: false };
        const mesesRef = destino.plan?.vencimientoRegularidadMeses ?? args.meses;
        const reg = await regularesVencidos(mesesRef);
        const duplicados = await historialDuplicado();

        mostrarInforme({ pend, destino, args, reg, duplicados, mesesRef });

        if (args.apply && duplicados.length > 0 && !args.aceptarDuplicados) {
            throw new Error('Hay historiales duplicados sin resolver (ver el detalle arriba). Resolvelos o ejecutá con --aceptar-duplicados para migrar igual.');
        }

        if (!args.apply) {
            console.log('\nSIMULACIÓN terminada: no se escribió nada. Para aplicar los cambios ejecutá:  node scripts/migrate-v2.js --apply');
            return;
        }

        console.log('\n=== Backup previo ===');
        const dir = await hacerBackup();
        console.log(`  Guardado en: ${dir}`);

        console.log('\n=== Aplicando migración ===');
        await aplicar({ destino, args });

        const despues = await contarPendientes();
        console.log('\n=== Pendientes luego de migrar (deberían ser 0) ===');
        fila('Materias sin plan', despues.materiasSinPlan);
        fila('Cohortes sin plan', despues.cohortesSinPlan);
        fila('Períodos sin tipo', despues.periodosSinTipo);
        fila('Historial sin intento/vigente', despues.historialSinIntento);
        fila('Alumnos sin tipo de ingreso', despues.alumnosSinIngreso);
        fila('Alumnos sin datos de pase', despues.alumnosSinPase);
        if (despues.regularesSinFecha > 0) {
            console.log(`  (Regulares sin ninguna fecha para tomar como referencia: ${despues.regularesSinFecha}. Cargarles la fecha a mano.)`);
        }
        console.log('\nMigración terminada. Los índices nuevos se crean solos la próxima vez que arranque el servidor.');
    } finally {
        await mongoose.disconnect();
        console.log('Desconectado de MongoDB.');
    }
};

main().catch(err => {
    console.error('Error en la migración:', err.message);
    process.exitCode = 1;
});
