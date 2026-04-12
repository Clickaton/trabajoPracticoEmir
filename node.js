const express = require('express');
const { crearUsuario, } = require('../models/Usuario');

function crearUsuario(req, res) {
    const { nombre, email, password } = req.body;

    if (!nombre || !email || !password) {
        return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const nuevoUsuario = new crearUsuario({ nombre, email, password });
    nuevoUsuario.save()
        .then(() => res.status(201).json({ message: 'Usuario creado exitosamente' }))
        .catch((error) => res.status(500).json({ error: 'Error al crear el usuario' }));
}

/* 
    module.export = exporto la clase.
*/ 