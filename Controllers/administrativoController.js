import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Administrativo from '../models/Administrativo.js';

// En ES6 con módulos, __dirname no existe de forma nativa, hay que reconstruirlo
const __filename = fileURLToPath(import.meta.url); // Obtiene la ruta completa del archivo actual
const __dirname = path.dirname(__filename); // Le saca el nombre del archivo y te queda solo el directorio

const rutaArchivo = path.join(__dirname, '../data/administrativos.json');

const leerAdministrativos = () => {
    const datos = fs.readFileSync(rutaArchivo, 'utf-8');
    return JSON.parse(datos);
};

const guardarAdministrativos = (lista) => {
    fs.writeFileSync(rutaArchivo, JSON.stringify(lista, null, 2));
};

// Helper: quita la contraseña antes de enviar datos a vistas o API
const omitPassword = (admin) => {
    const { password, ...adminSinPassword } = admin;
    return adminSinPassword;
};

// RENDERIZAR VISTAS
const getAdministrativos = (req, res) => {
    const lista = leerAdministrativos();
    res.render('administrativos/lista', { administrativos: lista.map(omitPassword) });
};

const getRegisterForm = (req, res) => {
    res.render('administrativos/registrar');
};

const getEditForm = (req, res) => {
    const lista = leerAdministrativos();
    const admin = lista.find(a => a.id === parseInt(req.params.id));
    if (!admin) return res.status(404).send("Administrativo no encontrado");

    res.render('administrativos/editar', { admin });
};

// PROCESAR DATOS (POST / API)
const getAdministrativoById = (req, res) => {
    const lista = leerAdministrativos();
    const admin = lista.find(a => a.id === parseInt(req.params.id));
    if (!admin) return res.status(404).json({ error: "Administrativo no encontrado" });

    res.json({ data: omitPassword(admin) });
};

const createAdministrativo = (req, res) => {
    const { id, name, email, password, rol, area } = req.body;
    const lista = leerAdministrativos();

    const nuevoAdmin = new Administrativo(parseInt(id), name, email, password, rol, area);
    lista.push(nuevoAdmin);
    guardarAdministrativos(lista);

    res.redirect('/api/administrativos');
};

const updateAdministrativo = (req, res) => {
    const lista = leerAdministrativos();
    const index = lista.findIndex(a => a.id === parseInt(req.params.id));
    if (index === -1) return res.status(404).send("Administrativo no encontrado");

    const { name, email, password, rol, area } = req.body;

    if (name) lista[index].name = name;
    if (email) lista[index].email = email;
    if (password) lista[index].password = password;
    if (rol) lista[index].rol = rol;
    if (area) lista[index].area = area;

    guardarAdministrativos(lista);
    res.redirect('/api/administrativos');
};

const deleteAdministrativo = (req, res) => {
    const lista = leerAdministrativos();
    const index = lista.findIndex(a => a.id === parseInt(req.params.id));
    if (index === -1) return res.status(404).send("Administrativo no encontrado");

    lista.splice(index, 1);
    guardarAdministrativos(lista);
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