const express = require('express');
const router = express.Router();
const TipoEntrega = require('../services/TipoEntrega');

const tipoEntrega = new TipoEntrega();

router.get('/combo', async function (req, res) {
    const result = await tipoEntrega.combo(req)
    if (Array.isArray(result)) {
        res.status(200).send(result);
    } else {
        res.status(400).send(result);
    }
});

module.exports = router;