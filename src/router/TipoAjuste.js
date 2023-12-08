const express = require('express');
const router = express.Router();
const TipoAjuste = require('../services/TipoAjuste');

const tipoAjuste = new TipoAjuste();

router.get('/combo', async function (req, res) {
    const result = await tipoAjuste.combo(req)
    if (Array.isArray(result)) {
        res.status(200).send(result);
    } else {
        res.status(400).send(result);
    }
});

module.exports = router;