import express from 'express';
import * as sheetsController from '../Controllers/sheetsController.js';
import { requireLogin } from '../middlewares/authHybrid.js';

const router = express.Router();

// Protegemos la ruta para que solo usuarios logueados puedan abrir los Sheets
router.use(requireLogin);

// Ruta que va a llamar el botón desde el Pug
router.get('/abrir-cohorte/:cohorteId', sheetsController.abrirPlanillaCohorte);

export default router;