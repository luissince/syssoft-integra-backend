const express = require('express');
const router = express.Router();
const ModalidadTraslado = require('../services/ModalidadTraslado');

const modalidadTraslado = new ModalidadTraslado();

router.get('/combo', async function (req, res) {
    const result = await modalidadTraslado.combo(req)
    if (Array.isArray(result)) {
        res.status(200).send(result);
    } else {
        res.status(400).send(result);
    }
});

module.exports = router;