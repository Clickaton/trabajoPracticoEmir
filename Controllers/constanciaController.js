import Constancia from '../models/Constancia.js';
import Alumno from '../models/Alumno.js';
import Materia from '../models/Materia.js'; // 
import HistorialAcademico from '../models/HistorialAcademico.js'; // 
import PDFDocument from 'pdfkit-table';
import crypto from 'crypto';
import fs from 'fs'; 
import QRCode from 'qrcode';

const baseUrl =
    process.env.APP_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    `${req.protocol}://${req.get('host')}`;

export const generarConstanciaPDF = async (req, res) => {
    try {
        const { dni, presentar_a, observaciones } = req.body;
        const alumnoIdLogueado = req.user.id;

        if (!dni || !presentar_a) {
            return res.status(400).json({ error: "Faltan datos obligatorios (DNI o Presentar a)" });
        }

        const alumno = await Alumno.findOne({ dni: dni });
        if (!alumno) {
            return res.status(404).json({ error: "No se encontró ningún alumno con ese DNI." });
        }
        
        if (alumno.id !== parseInt(alumnoIdLogueado)) {
            return res.status(403).json({ error: "El DNI ingresado no coincide con tu usuario." });
        }
        if (!alumno.activo) {
            return res.status(403).json({ error: "No te encuentras activo para solicitar constancias." });
        }

        const fechaEmision = new Date();
        const fechaVencimiento = new Date();
        fechaVencimiento.setDate(fechaEmision.getDate() + 5); 
        
        const codigoValidacion = crypto.randomBytes(4).toString('hex').toUpperCase(); 

        const maxConstancia = await Constancia.findOne().sort('-id').lean();
        const nuevoId = maxConstancia ? maxConstancia.id + 1 : 1;

        await Constancia.create({
            id: nuevoId,
            alumno_id: alumno.id,
            presentar_a,
            observaciones,
            fecha_emision: fechaEmision,
            fecha_vencimiento: fechaVencimiento,
            codigo_validacion: codigoValidacion
        });

        // ==========================================
        // GENERACIÓN DEL CÓDIGO QR EN MEMORIA
        // ==========================================


        const urlValidacion = `${baseUrl}/validar/${codigoValidacion}`;
        
        const qrBuffer = await QRCode.toBuffer(urlValidacion, { 
            margin: 1,
            color: { dark: '#000000', light: '#FFFFFF' }
        });

        // ==========================================
        // CREAR EL ARCHIVO PDF
        // ==========================================
        const doc = new PDFDocument({ margin: 50, size: 'A4' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Constancia_Regular_${alumno.dni}.pdf`);
        doc.pipe(res);

        const logoIzq = './public/img/logo225.png';
        const logoDer = './public/img/logo_gba.png';
        const sello = './public/img/SelloInstitucional.png';

        if (fs.existsSync(logoIzq)) {
            doc.image(logoIzq, 50, 40, { width: 70 }); 
        }
        if (fs.existsSync(logoDer)) {
            doc.image(logoDer, 445, 40, { width: 100 }); 
        }

        doc.moveDown(5);

        doc.fontSize(16).font('Helvetica-Bold').text('CONSTANCIA DE ALUMNO REGULAR', { align: 'center' });
        doc.moveDown(3);

        doc.fontSize(12).font('Helvetica')
           .text(`Se deja constancia de que, a la fecha, `, { continued: true, align: 'justify' })
           .font('Helvetica-Bold').text(`${alumno.name}`, { continued: true })
           .font('Helvetica').text(` - DNI `, { continued: true })
           .font('Helvetica-Bold').text(`${alumno.dni} `, { continued: true })
           .font('Helvetica').text(` es estudiante regular del Instituto Superior de Formación Técnica N°225, de la especialidad `, { continued: true })
           .font('Helvetica-Bold').text(`DESARROLLO DE SOFTWARE.`, { align: 'justify' });
        
        doc.moveDown(2);

        const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        const dia = fechaEmision.getDate();
        const mes = meses[fechaEmision.getMonth()];
        const anio = fechaEmision.getFullYear();

        doc.fontSize(12).font('Helvetica')
           .text(`A pedido del interesado/a y para presentar a `, { continued: true, align: 'justify' })
           .font('Helvetica-Bold').text(`${presentar_a}`, { continued: true })
           .font('Helvetica').text(`, se extiende la presente en la ciudad de San Martín a los ${dia} días del mes de ${mes} de ${anio}.`, { align: 'justify' });

        doc.moveDown(4);

        // ==========================================
        // ZONA DE FIRMAS (SELLO IZQUIERDA Y QR DERECHA)
        // ==========================================
        const elementosY = doc.y; // Guardamos la altura para alinear ambos elementos
        
        // --- SELLO A LA IZQUIERDA ---
        if (fs.existsSync(sello)) {
            doc.image(sello, 50, elementosY, { width: 140 }); // X: 50 (Margen izquierdo)
            doc.y = elementosY + 145; 
        } else {
            doc.y = elementosY + 70; 
        }

        // Línea del Sello a la izquierda
        doc.moveTo(50, doc.y).lineTo(190, doc.y).stroke();
        doc.y += 5; 
        
        // Texto centrado solo bajo el ancho del sello
        doc.fontSize(10).fillColor('black').font('Helvetica').text('Sello Institucional', 50, doc.y, { width: 140, align: 'center' });

        // --- QR A LA DERECHA ---
        // Lo imprimimos a la misma altura (elementosY), pero en el margen derecho (X: 445)
        // Le sumamos 20 a la Y para que quede un poco más centrado con respecto al sello que es más alto
        doc.image(qrBuffer, 445, elementosY + 20, { width: 100 });
        // Hacemos que la zona del QR (X, Y, Ancho, Alto) sea un link interactivo
        doc.link(445, elementosY + 20, 100, 100, urlValidacion);

        // NUEVO: Texto debajo del QR
        doc.fontSize(8).fillColor('gray').font('Helvetica');
        // Lo posicionamos en Y: elementosY + 125 (bajando justo por debajo de la imagen del QR)
        doc.text('Escanear QR para validar', 445, elementosY + 125, { width: 100, align: 'center' });

        // ==========================================
        // PIE DE PÁGINA (Validez y Dirección)
        // ==========================================
        const footerY = doc.page.height - 130; 
        const fechaVencimientoFormateada = fechaVencimiento.toLocaleDateString('es-AR');
        
        doc.fontSize(9).fillColor('gray').font('Helvetica');
        doc.text(`IMPORTANTE: Este documento tiene una validez de 5 (cinco) días hábiles a partir de su emisión.`, 50, footerY, { align: 'center', width: doc.page.width - 100 });
        doc.text(`Válido hasta: ${fechaVencimientoFormateada} inclusive.`, { align: 'center', width: doc.page.width - 100 });
        doc.moveDown(0.5);
        doc.text(`Código de Validación Único: ${codigoValidacion}`, { align: 'center', width: doc.page.width - 100 });

        doc.moveDown(1.5);
        doc.fillColor('black').font('Helvetica-Bold');
        doc.text('Rivadavia 3915 - San Martin - 5354-6600 interno 9080 - isft-225.sm@faterh.org.ar', { align: 'center', width: doc.page.width - 100 });

        doc.end();

    } catch (error) {
        console.error(error);
        if (!res.headersSent) {
            res.status(500).json({ error: "Error interno al generar la constancia." });
        }
    }
};

export const getConstanciasAlumno = async (req, res) => {
    try {
        const alumnoId = req.user.id; 
        const constancias = await Constancia.find({ alumno_id: parseInt(alumnoId) }).sort({ fecha_emision: -1 }).lean();
        
        res.json({ message: "Listado de constancias", data: constancias });
    } catch (error) {
        res.status(500).json({ error: "Error al obtener las constancias." });
    }
};

export const validarConstanciaPublica = async (req, res) => {
    try {
        const { codigo } = req.params;
        
        // 1. Buscamos la constancia por el código exacto
        const constancia = await Constancia.findOne({ codigo_validacion: codigo }).lean();

        // 2. Si no existe, mostramos pantalla de error
        if (!constancia) {
            return res.render('validacion', { 
                valido: false, 
                mensaje: "El documento es falso o el código es incorrecto." 
            });
        }

        // 3. Si existe, buscamos los datos del alumno
        const alumno = await Alumno.findOne({ id: constancia.alumno_id }).lean();
        
        // 4. Verificamos si ya pasaron los 5 días
        const hoy = new Date();
        const vencida = hoy > new Date(constancia.fecha_vencimiento);

        // 5. Renderizamos la pantalla de éxito
        res.render('validacion', {
            valido: true,
            vencida: vencida,
            constancia: constancia,
            alumno: alumno
        });

    } catch (error) {
        console.error(error);
        res.status(500).send("Error interno del servidor");
    }
};

export const generarPorcentajePDF = async (req, res) => {
    try {
        const { dni, presentar_a } = req.body;
        const alumnoIdLogueado = req.user.id;

        if (!dni || !presentar_a) return res.status(400).json({ error: "Faltan datos obligatorios" });

        const alumno = await Alumno.findOne({ dni: dni }).lean();
        if (!alumno) return res.status(404).json({ error: "No se encontró ningún alumno con ese DNI." });
        if (alumno.id !== parseInt(alumnoIdLogueado)) return res.status(403).json({ error: "El DNI no coincide con tu usuario." });
        if (!alumno.activo) return res.status(403).json({ error: "No te encuentras activo." });

        // Datos académicos
        const materias = await Materia.find().sort({ anio: 1 }).lean();
        const historial = await HistorialAcademico.find({ alumno_id: alumno.id }).lean();
        
        const totalMaterias = materias.length;
        const materiasAprobadas = historial.filter(h => h.estado === "Aprobada").length;
        const porcentaje = totalMaterias > 0 ? Math.round((materiasAprobadas / totalMaterias) * 100) : 0;

        // Base de Datos
        const fechaEmision = new Date();
        const fechaVencimiento = new Date();
        fechaVencimiento.setDate(fechaEmision.getDate() + 5); 
        
        const codigoValidacion = crypto.randomBytes(4).toString('hex').toUpperCase(); 
        const maxConstancia = await Constancia.findOne().sort('-id').lean();
        const nuevoId = maxConstancia ? maxConstancia.id + 1 : 1;

        await Constancia.create({
            id: nuevoId,
            alumno_id: alumno.id,
            tipo_constancia: 'Porcentaje de Materias',
            presentar_a,
            fecha_emision: fechaEmision,
            fecha_vencimiento: fechaVencimiento,
            codigo_validacion: codigoValidacion
        });

        // QR
        const urlValidacion = `${baseUrl}/validar/${codigoValidacion}`;
        const qrBuffer = await QRCode.toBuffer(urlValidacion, { margin: 1 });

        // PDF
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Porcentaje_Materias_${alumno.dni}.pdf`);
        doc.pipe(res);

        // Encabezado
        const logoIzq = './public/img/logo225.png';
        const logoDer = './public/img/logo_gba.png';
        if (fs.existsSync(logoIzq)) doc.image(logoIzq, 50, 40, { width: 50 }); 
        if (fs.existsSync(logoDer)) doc.image(logoDer, 445, 40, { width: 90 }); 

        doc.moveDown(4);
        doc.fontSize(14).font('Helvetica-Bold').text('CERTIFICADO DE PORCENTAJE DE MATERIAS', { align: 'center' });
        doc.moveDown(2);

        doc.fontSize(11).font('Helvetica')
           .text(`Alumno/a: `, { continued: true }).font('Helvetica-Bold').text(`${alumno.name}    `, { continued: true })
           .font('Helvetica').text(`DNI: `, { continued: true }).font('Helvetica-Bold').text(`${alumno.dni}`);
        doc.moveDown(1);
        doc.font('Helvetica').text(`Porcentaje de carrera aprobado: `, { continued: true }).font('Helvetica-Bold').text(`${porcentaje}% (${materiasAprobadas} de ${totalMaterias} materias)`);
        doc.moveDown(1);
        doc.font('Helvetica').text(`Constancia expedida para presentar a: `, { continued: true }).font('Helvetica-Bold').text(`${presentar_a}`);
        doc.moveDown(2);

        // --- LÓGICA OFICIAL DE TABLA ---
        const tableArray = {
            headers: [
                { label: "Materia", property: 'materia', width: 250 },
                { label: "Año", property: 'anio', width: 60 },
                { label: "Estado", property: 'estado', width: 100 },
                { label: "Nota", property: 'nota', width: 80 }
            ],
            datas: materias.map(mat => {
                const registro = historial.find(h => h.materia_id === mat.id);
                const estado = registro ? registro.estado : 'Pendiente';
                return {
                    materia: mat.nombre,
                    anio: `${mat.anio}º`,
                    estado: estado === 'Pendiente' ? '-----' : estado,
                    nota: (estado === 'Aprobada' && registro.nota) ? registro.nota.toString() : '-----'
                };
            })
        };

        await doc.table(tableArray, {
            prepareHeader: () => doc.font("Helvetica-Bold").fontSize(10),
            prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
                doc.font("Helvetica").fontSize(9);
            }
        });

        // Firmas y validación dinámicas
        doc.moveDown(0.2);
        
        // Estiramos el límite a 650 para evitar saltos innecesarios
        if (doc.y > 650) {
            doc.addPage();
        }

        const currentY = doc.y;
        const sello = './public/img/SelloInstitucional.png';
        
        // Sello achicado a 90px
        if (fs.existsSync(sello)) doc.image(sello, 50, currentY, { width: 90 }); 
        
        // Línea de firma ajustada a la nueva altura del sello
        doc.moveTo(50, currentY + 100).lineTo(190, currentY + 100).stroke();
        doc.fontSize(10).text('Sello Institucional', 50, currentY + 105, { width: 140, align: 'center' });

        // QR achicado a 70px y movido un poco más a la derecha
        doc.image(qrBuffer, 460, currentY + 15, { width: 70 });
        doc.link(460, currentY + 15, 70, 70, urlValidacion);
        doc.fontSize(8).fillColor('gray').text('Escanear QR para validar', 445, currentY + 90, { width: 100, align: 'center' });

        // Pie de página absoluto
        const footerY = doc.page.height - 60; 
        doc.fontSize(8).fillColor('gray');
        doc.text(`Válido por 5 días hábiles. Vence: ${fechaVencimiento.toLocaleDateString('es-AR')}. Código: ${codigoValidacion}`, 50, footerY - 15, { align: 'center', width: doc.page.width - 100 });
        doc.fillColor('black').font('Helvetica-Bold');
        doc.text('Rivadavia 3915 - San Martin - 5354-6600 interno 9080 - isft-225.sm@faterh.org.ar', 50, footerY, { align: 'center', width: doc.page.width - 100 });

        doc.end();
    } catch (error) {
        console.error(error);
        if (!res.headersSent) res.status(500).json({ error: "Error interno al generar." });
    }
};

export default { generarConstanciaPDF, getConstanciasAlumno, validarConstanciaPublica, generarPorcentajePDF };