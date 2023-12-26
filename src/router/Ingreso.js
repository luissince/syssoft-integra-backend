const express = require('express');
const router = express.Router();
const Ingreso = require('../services/Ingreso')

const ingreso = new Ingreso();

router.get('/list', async function (req, res) {
    const result = await ingreso.list(req)
    if (typeof result === 'object') {
        res.status(200).send(result)
    } else {
        res.status(500).send(result)
    }
});

router.delete('/cancel', async function (req, res) {
    const result = await ingreso.cancel(req)
    if (result === 'cancel') {
        res.status(200).send("Se anuló correctamente la el pago.");
    } else {
        res.status(500).send(result);
    }
});


module.exports = router;