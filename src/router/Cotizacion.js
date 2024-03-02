const express = require('express');
const router = express.Router();

const Cotizacion = require('../services/Cotizacion');

const cotizacion = new Cotizacion();

router.get('/list', async function (req, res) {
    const result = await cotizacion.list(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.get('/id', async function (req, res) {
    const result = await cotizacion.id(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.get('/detail', async function (req, res) {
    const result = await cotizacion.detail(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.post('/create', async function (req, res) {
    const result = await cotizacion.create(req)
    if (result === 'create') {
        res.status(200).send("Se registró correctamente la cotización.");
    } else {
        res.status(500).send(result);
    }
});

router.delete('/cancel', async function (req, res) {
    const result = await cotizacion.cancel(req)
    if (result === 'cancel') {
        res.status(200).send("Se anuló correctamente la cotización.");
    } else {
        res.status(500).send(result);
    }
});


module.exports = router;