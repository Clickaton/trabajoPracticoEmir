import Administrativo from '../models/Administrativo.js';
import { getDB } from '../config/db.js';

const getCollection = () => getDB().collection('administrativos');

// Helper: quita la contraseña antes de enviar datos a vistas o API
const omitPassword = (admin) => {
    const { password, ...adminSinPassword } = admin;
    return adminSinPassword;
};

// RENDERIZAR VISTAS
const getAdministrativos = async (req, res) => {
    const lista = await getCollection().find().toArray();
    res.render('administrativos/lista', { administrativos: lista.map(omitPassword) });
};

const getRegisterForm = (req, res) => {
    res.render('administrativos/registrar');
};

const getEditForm = async (req, res) => {
    const admin = await getCollection().findOne({ id: parseInt(req.params.id) });
    if (!admin) return res.status(404).send("Administrativo no encontrado");

    res.render('administrativos/editar', { admin });
};

// PROCESAR DATOS (POST / API)
const getAdministrativoById = async (req, res) => {
    const admin = await getCollection().findOne({ id: parseInt(req.params.id) });
    if (!admin) return res.status(404).json({ error: "Administrativo no encontrado" });

    res.json({ data: omitPassword(admin) });
};

const createAdministrativo = async (req, res) => {
    const { id, name, email, password, rol, area } = req.body;

    const nuevoAdmin = new Administrativo(parseInt(id), name, email, password, rol, area);
    await getCollection().insertOne(nuevoAdmin);

    res.redirect('/api/administrativos');
};

const updateAdministrativo = async (req, res) => {
    const { name, email, password, rol, area } = req.body;
    
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (password) updateData.password = password;
    if (rol) updateData.rol = rol;
    if (area) updateData.area = area;

    const result = await getCollection().updateOne({ id: parseInt(req.params.id) }, { $set: updateData });
    if (result.matchedCount === 0) return res.status(404).send("Administrativo no encontrado");
    
    res.redirect('/api/administrativos');
};

const deleteAdministrativo = async (req, res) => {
    const result = await getCollection().deleteOne({ id: parseInt(req.params.id) });
    if (result.deletedCount === 0) return res.status(404).send("Administrativo no encontrado");
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