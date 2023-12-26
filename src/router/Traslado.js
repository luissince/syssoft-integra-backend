const express = require('express');
const router = express.Router();

const Traslado = require('../services/Traslado');

const traslado = new Traslado();

router.get('/list', async function (req, res) {
    const result = await traslado.list(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.get('/detail', async function (req, res) {
    const result = await traslado.detail(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.post('/create', async function (req, res) {
    const result = await traslado.create(req)
    if (result === 'create') {
        res.status(200).send("Se registró correctamente el traslado.");
    } else {
        res.status(500).send(result);
    }
});

router.delete('/cancel', async function (req, res) {
    const result = await traslado.cancel(req)
    if (result === 'cancel') {
        res.status(200).send("Se anuló el traslado correctamente.");
    } else {
        res.status(500).send(result);
    }
});


module.exports = router;