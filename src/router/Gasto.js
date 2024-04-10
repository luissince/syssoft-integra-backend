const express = require('express');
const router = express.Router();
const Gasto = require('../services/Gasto');

const gasto = new Gasto();

router.get('/list', async function (req, res) {
    const result = await gasto.list(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.post('/create', async function (req, res) {
    const result = await gasto.create(req)
    if (result === 'create') {
        res.status(201).send("Se registró correctamente el gasto.");
    } else {
        res.status(500).send(result);
    }
});

router.get('/detail', async function (req, res) {
    const result = await gasto.detail(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.delete('/cancel', async function (req, res) {
    const result = await gasto.cancel(req, res)
    if (result === 'cancel') {
        res.status(201).send("Se anualo correctamente el gasto.");
    } else {
        res.status(500).send(result);
    }
});

module.exports = router;