const express = require('express');
const router = express.Router();
const TipoAlmacen = require('../services/TipoAlmacen');

const tipoAlmacen = new TipoAlmacen();

router.get('/combo', async function (req, res) {
    const result = await tipoAlmacen.combo(req)
    if (Array.isArray(result)) {
        res.status(200).send(result);
    } else {
        res.status(400).send(result);
    }
});

module.exports = router;