const express = require('express');
const router = express.Router();
const MotivoTraslado = require('../services/MotivoTraslado');

const motivoTraslado = new MotivoTraslado();

router.get('/combo', async function (req, res) {
    const result = await motivoTraslado.combo(req)
    if (Array.isArray(result)) {
        res.status(200).send(result);
    } else {
        res.status(400).send(result);
    }
});

module.exports = router;