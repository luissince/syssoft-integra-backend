const express = require('express');
const router = express.Router();

const GuiaRemision = require('../services/GuiaRemision');

const guiaRemision = new GuiaRemision();

router.get('/list', async function (req, res) {
    const result = await guiaRemision.list(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.get('/id', async function (req, res) {
    const result = await guiaRemision.id(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.get('/detail', async function (req, res) {
    const result = await guiaRemision.detail(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.get('/detail/update', async function (req, res) {
    const result = await guiaRemision.detailUpdate(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.post('/create', async function (req, res) {
    const result = await guiaRemision.create(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.put('/update', async function (req, res) {
    const result = await guiaRemision.update(req)
    if (result === 'update') {
        res.status(200).send("Se actualizón correctamente la guían de remisión.");
    } else {
        res.status(500).send(result);
    }
});

router.delete('/cancel', async function (req, res) {
    const result = await guiaRemision.cancel(req)
    if (result === 'cancel') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});


module.exports = router;