const express = require('express');
const router = express.Router();
const Persona = require('../services/Persona');

const persona = new Persona();

router.get('/list', async function (req, res) {
    const result = await persona.list(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.get('/list/clientes', async function (req, res) {
    const result = await persona.listClientes(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.get('/list/proveedores', async function (req, res) {
    const result = await persona.listProveedores(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.get('/list/conductores', async function (req, res) {
    const result = await persona.listConductores(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.post('/create', async function (req, res) {
    const result = await persona.create(req)
    if (result === 'create') {
        res.status(201).send("Se registró correctamente la persona.");
    } else {
        res.status(500).send(result);
    }
});

router.get('/id', async function (req, res) {
    const result = await persona.id(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.post('/update', async function (req, res) {
    const result = await persona.update(req)
    if (result === 'update') {
        res.status(201).send("Se actualizó correctamente la persona.");
    } else {
        res.status(500).send(result);
    }
});

router.delete('/', async function (req, res) {
    const result = await persona.delete(req)
    if (result === 'delete') {
        res.status(201).send("Se eliminó correctamente la persona.");
    } else {
        res.status(500).send(result);
    }
});

router.get('/combo', async function (req, res) {
    const result = await persona.combo(req)
    if (Array.isArray(result)) {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.get('/filtrar', async function (req, res) {
    const result = await persona.filtrar(req)
    if (Array.isArray(result)) {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.get('/predeterminado', async function (req, res) {
    const result = await persona.predeterminado(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else if (result === "") {
        res.status(200).send("");
    } else {
        res.status(500).send(result);
    }
});


module.exports = router;