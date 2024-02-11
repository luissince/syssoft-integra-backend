const express = require('express');
const router = express.Router();
const TipoPeso = require('../services/TipoPeso');

const tipoPeso = new TipoPeso();

router.get('/combo', async function (req, res) {
    const result = await tipoPeso.combo(req)
    if (Array.isArray(result)) {
        res.status(200).send(result);
    } else {
        res.status(400).send(result);
    }
});

module.exports = router;