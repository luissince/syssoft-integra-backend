const express = require('express');
const router = express.Router();
const { decrypt } = require('../tools/CryptoJS');
const { generateExcelCliente, generateExcelDeudas, generarSociosPorFecha } = require('../excel/FileClientes')
const empresa = require('../services/Empresa');
const Cliente = require('../services/Cliente');
const RepCliente = require('../report/RepCliente');

const cliente = new Cliente();
const repCliente = new RepCliente();
/**
 * Api usado en los modulos
 * [facturación: clientes]
 */
router.get('/list', async function (req, res) {
    const result = await cliente.list(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.get('/listsocios', async function (req, res) {
    const result = await cliente.listsocios(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.post('/create', async function (req, res) {
    const result = await cliente.create(req)
    if (result === 'create') {
        res.status(201).send("Se registró correctamente el cliente.");
    } else {
        res.status(500).send(result);
    }
});

router.get('/id', async function (req, res) {
    const result = await cliente.id(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.post('/update', async function (req, res) {
    const result = await cliente.update(req)
    if (result === 'update') {
        res.status(201).send("Se actualizó correctamente el cliente.");
    } else {
        res.status(500).send(result);
    }
});

router.delete('/', async function (req, res) {
    const result = await cliente.delete(req)
    if (result === 'delete') {
        res.status(201).send("Se eliminó correctamente el cliente.");
    } else {
        res.status(500).send(result);
    }
});

router.get('/listcombo', async function (req, res) {
    const result = await cliente.listcombo(req)
    if (Array.isArray(result)) {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.get('/filtrar', async function (req, res) {
    const result = await cliente.filtrar(req)
    if (Array.isArray(result)) {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.get('/predeterminado', async function (req, res) {
    const result = await cliente.predeterminado(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else if (result === "") {
        res.status(200).send("");
    } else {
        res.status(500).send(result);
    }
});


module.exports = router;