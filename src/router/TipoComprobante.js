const express = require('express');
const router = express.Router();
const TipoComprobante = require('../services/TipoComprobante');

const tipoComprobante = new TipoComprobante();

router.get('/combo', async function (req, res) {
    const result = await tipoComprobante.combo(req)
    if (Array.isArray(result)) {
        res.status(200).send(result);
    } else {
        res.status(400).send(result);
    }
});

module.exports = router;