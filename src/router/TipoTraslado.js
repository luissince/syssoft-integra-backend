const express = require('express');
const router = express.Router();
const TipoTraslado = require('../services/TipoTraslado');

const tipoTraslado = new TipoTraslado();

router.get('/combo', async function (req, res) {
    const result = await tipoTraslado.combo(req)
    if (Array.isArray(result)) {
        res.status(200).send(result);
    } else {
        res.status(400).send(result);
    }
});

module.exports = router;