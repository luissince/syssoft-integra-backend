const express = require('express');
const router = express.Router();
const Medida = require('../services/Medida');

const medida = new Medida();

router.get("/list", async function (req, res) {
    const result = await medida.list(req)
    if (typeof result === 'object') {
        res.status(200).send(result)
    } else {
        res.status(500).send(result)
    }
});

router.get('/id', async function (req, res) {
    const result = await medida.id(req);
    if (typeof result === 'object') {
        res.status(200).send(result)
    } else {
        res.status(500).send(result)
    }
})

router.post("/", async function (req, res) {
    const result = await medida.add(req);
    if (result === 'insert') {
        res.status(200).send("Se registró correctamente la medida.");
    } else {
        res.status(500).send(result);
    }
});

router.put("/", async function (req, res) {
    const result = await medida.edit(req);
    if (result === 'update') {
        res.status(200).send("Se actualizó correctamente la medida.");
    } else {
        res.status(500).send(result);
    }
});

router.delete('/', async function (req, res) {
    const result = await medida.delete(req);
    if (result === 'delete') {
        res.status(200).send("Se eliminó correctamente la medida.");
    } else {
        res.status(500).send(result);
    }
});

router.get('/combo', async function (req, res) {
    const result = await medida.combo(req);
    if (Array.isArray(result)) {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

module.exports = router;