const express = require('express');
const router = express.Router();
const Cobro = require('../services/Cobro');

const cobro = new Cobro();

router.get('/list', async function (req, res) {
    const result = await cobro.list(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.post('/create', async function (req, res) {
    const result = await cobro.create(req)
    if (result === 'create') {
        res.status(201).send("Se registró correctamente el cobro.");
    } else {
        res.status(500).send(result);
    }
});

router.get('/detail', async function (req, res) {
    const result = await cobro.detail(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.delete('/cancel', async function (req, res) {
    const result = await cobro.cancel(req, res)
    if (result === 'cancel') {
        res.status(201).send("Se anualo correctamente el cobro.");
    } else {
        res.status(500).send(result);
    }
});

router.get('/notificaciones', async function (req, res) {
    const result = await cobro.notificaciones(req)
    if (Array.isArray(result)) {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.get('/detallenotificaciones', async function (req, res) {
    const result = await cobro.detalleNotificaciones(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});



module.exports = router;