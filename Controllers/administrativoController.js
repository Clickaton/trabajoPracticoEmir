import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Administrativo from '../models/Administrativo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rutaArchivo = path.join(__dirname, '../data/administrativos.json');

const leerAdministrativos = async () => {
    const datos = await fs.readFile(rutaArchivo, 'utf-8');
    return JSON.parse(datos);
};

const guardarAdministrativos = async (lista) => {
    await fs.writeFile(rutaArchivo, JSON.stringify(lista, null, 2));
};

// Helper: quita la contraseña antes de enviar datos a vistas o API
const omitPassword = (admin) => {
    const { password, ...adminSinPassword } = admin;
    return adminSinPassword;
};

// RENDERIZAR VISTAS
const getAdministrativos = async (req, res) => {
    const lista = await leerAdministrativos();
    res.render('administrativos/lista', { administrativos: lista.map(omitPassword) });
};

const getRegisterForm = (req, res) => {
    res.render('administrativos/registrar');
};

const getEditForm = async (req, res) => {
    const lista = await leerAdministrativos();
    const admin = lista.find(a => a.id === parseInt(req.params.id));
    if (!admin) return res.status(404).send("Administrativo no encontrado");

    res.render('administrativos/editar', { admin });
};

// PROCESAR DATOS (POST / API)
const getAdministrativoById = async (req, res) => {
    const lista = await leerAdministrativos();
    const admin = lista.find(a => a.id === parseInt(req.params.id));
    if (!admin) return res.status(404).json({ error: "Administrativo no encontrado" });

    res.json({ data: omitPassword(admin) });
};

const createAdministrativo = async (req, res) => {
    const { id, name, email, password, rol, area } = req.body;
    const lista = await leerAdministrativos();

    const nuevoAdmin = new Administrativo(parseInt(id), name, email, password, rol, area);
    lista.push(nuevoAdmin);
    await guardarAdministrativos(lista);

    res.redirect('/api/administrativos');
};

const updateAdministrativo = async (req, res) => {
    const lista = await leerAdministrativos();
    const index = lista.findIndex(a => a.id === parseInt(req.params.id));
    if (index === -1) return res.status(404).send("Administrativo no encontrado");

    const { name, email, password, rol, area } = req.body;

    if (name) lista[index].name = name;
    if (email) lista[index].email = email;
    if (password) lista[index].password = password;
    if (rol) lista[index].rol = rol;
    if (area) lista[index].area = area;

    await guardarAdministrativos(lista);
    res.redirect('/api/administrativos');
};

const deleteAdministrativo = async (req, res) => {
    const lista = await leerAdministrativos();
    const index = lista.findIndex(a => a.id === parseInt(req.params.id));
    if (index === -1) return res.status(404).send("Administrativo no encontrado");

    lista.splice(index, 1);
    await guardarAdministrativos(lista);
    res.redirect('/api/administrativos');
};

export default {
    getAdministrativos,
    getRegisterForm,
    getEditForm,
    getAdministrativoById,
    createAdministrativo,
    updateAdministrativo,
    deleteAdministrativo
};