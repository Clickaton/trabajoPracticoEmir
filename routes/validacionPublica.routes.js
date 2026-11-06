import express from 'express';
import { validarConstanciaPublica } from '../Controllers/constanciaController.js';

const router = express.Router();

// Pública A PROPÓSITO: quien escanea el código QR de una constancia no tiene sesión. No agregar verifyToken acá.
router.get('/validar/:codigo', validarConstanciaPublica);

export default router;
