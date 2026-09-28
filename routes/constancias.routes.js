import express from 'express';
import constanciaController from '../Controllers/constanciaController.js';
import { verifyToken, requireOwnershipOrAdmin } from '../middlewares/authHybrid.js';

const router = express.Router();

// Protegemos el módulo: solo los usuarios autenticados con JWT pueden acceder
router.use(verifyToken);

// GET: Trae el listado de constancias generadas por el alumno para llenar la tabla
router.get('/mis-solicitudes', constanciaController.getConstanciasAlumno);

// POST: Recibe el DNI y los datos, y devuelve el archivo PDF descargable
router.post('/generar', constanciaController.generarConstanciaPDF);

// POST: Genera el certificado de porcentaje con la tabla de materias
router.post('/generar-porcentaje', constanciaController.generarPorcentajePDF);

export default router;