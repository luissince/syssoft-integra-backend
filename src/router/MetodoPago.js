const express = require('express');
const router = express.Router();
const MetodoPago = require('../services/MetodoPago');

const metodoPago = new MetodoPago();

router.get('/combo', async function (req, res) {
    const result = await metodoPago.combo(req)
    if (Array.isArray(result)) {
        res.status(200).send(result);
    } else {
        res.status(400).send(result);
    }
});

module.exports = router;