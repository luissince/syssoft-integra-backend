const express = require('express');
const router = express.Router();
const Salida = require('../services/Salida')

const salida = new Salida();

router.get('/list', async function (req, res) {
    const result = await salida.list(req)
    if (typeof result === 'object') {
        res.status(200).send(result)
    } else {
        res.status(500).send(result)
    }
});

router.delete('/cancel', async function (req, res) {
    const result = await salida.cancel(req)   
    if (result === 'cancel') {
        res.status(200).send("Se anuló correctamente la el pago.");
    } else {
        res.status(500).send(result);
    }
});


module.exports = router;