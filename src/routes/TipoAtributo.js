const express = require('express');
const router = express.Router();
const TipoAtributo = require('../services/TipoAtributo');

const tipoAtributo = new TipoAtributo();

router.get('/combo', async function (req, res) {
    const result = await tipoAtributo.combo(req)
    if (Array.isArray(result)) {
        res.status(200).send(result);
    } else {
        res.status(400).send(result);
    }
});

module.exports = router;