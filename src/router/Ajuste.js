const express = require('express');
const router = express.Router();

const Ajuste = require('../services/Ajuste');

const ajuste = new Ajuste();

router.get('/list', async function (req, res) {
    const result = await ajuste.list(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.get('/detail', async function (req, res) {
    const result = await ajuste.detail(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.post('/create', async function (req, res) {
    const result = await ajuste.create(req)
    if (result === 'create') {
        res.status(200).send("Se registró correctamente el ajuste.");
    } else {
        res.status(500).send(result);
    }
});

router.delete('/cancel', async function (req, res) {
    const result = await ajuste.cancel(req)
    if (result === 'cancel') {
        res.status(200).send("Se anuló el ajuste correctamente.");
    } else {
        res.status(500).send(result);
    }
});


module.exports = router;