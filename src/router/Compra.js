const express = require('express');
const router = express.Router();

const Compra = require('../services/Compra');

const compra = new Compra();

router.get('/list', async function (req, res) {
    const result = await compra.list(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.get('/id', async function (req, res) {
    const result = await compra.id(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.get('/detail', async function (req, res) {
    const result = await compra.detail(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.post('/create', async function (req, res) {
    const result = await compra.create(req)
    if (result === 'create') {
        res.status(200).send("Se registró correctamente la compra.");
    } else {
        res.status(500).send(result);
    }
});

router.delete('/cancel', async function (req, res) {
    const result = await compra.cancel(req)
    if (result === 'cancel') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});


module.exports = router;