const express = require('express');
const router = express.Router();
const TipoPedido = require('../services/TipoPedido');

const tipoPedido = new TipoPedido();

router.get('/combo', async function (req, res) {
    const result = await tipoPedido.combo(req)
    if (Array.isArray(result)) {
        res.status(200).send(result);
    } else {
        res.status(400).send(result);
    }
});

module.exports = router;