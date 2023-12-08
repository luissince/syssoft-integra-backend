const express = require('express');
const router = express.Router();
const Inventario = require('../services/Inventario');

const inventario = new Inventario();

router.get('/list', async function (req, res) {
    const result = await inventario.list(req)
    if (typeof result === 'object') {
        res.status(200).send(result)
    } else {
        res.status(500).send(result)
    }
});

router.put('/actualizar/stock', async function (req, res) {
    const result = await inventario.actualizarStock(req)
    if (result === 'update') {
        res.status(201).send("Se actualizó correctamente el stock.");
    } else {
        res.status(500).send(result);
    }
});

router.get('/obtener/stock', async function (req, res) {
    const result = await inventario.obtenerStock(req)
    if (typeof result === 'object') {
        res.status(200).send(result)
    } else {
        res.status(500).send(result)
    }
});


module.exports = router;