const express = require('express');
const router = express.Router();
const Notificacion = require('../services/Notificacion');

const notificacion = new Notificacion();

router.get('/list', async function (req, res) {
    const result = await notificacion.list(req)
    if (Array.isArray(result)) {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.get('/detail', async function (req, res) {
    const result = await notificacion.detail(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

module.exports = router;