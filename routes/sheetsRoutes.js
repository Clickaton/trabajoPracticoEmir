import express from 'express';
import * as sheetsController from '../Controllers/sheetsController.js';
import { requireLogin, requireRole, requireAdminApi, ROLES_ADMINISTRATIVOS } from '../middlewares/authHybrid.js';

const router = express.Router();

// Solo usuarios logueados (y, más abajo, solo el personal administrativo: los alumnos no tienen nada que hacer acá)
router.use(requireLogin);

// Ruta que va a llamar el botón desde el Pug (se abre en una pestaña nueva)
router.get('/abrir-cohorte/:cohorteId', requireRole(ROLES_ADMINISTRATIVOS), sheetsController.abrirPlanillaCohorte);

// RUTA PARA SINCRONIZAR sheets con el sistema (la llama el panel con fetch: los rechazos son JSON)
router.get('/sync/:cohorteId', requireAdminApi, sheetsController.sincronizarCohorte);

export default router;