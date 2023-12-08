const express = require('express');
const router = express.Router();
const Categoria = require('../services/Categoria');

const categoria = new Categoria();

router.get("/list", async function (req, res) {
    const result = await categoria.list(req)
    if (typeof result === 'object') {
        res.status(200).send(result)
    } else {
        res.status(500).send(result)
    }
});

router.get('/id', async function (req, res) {
    const result = await categoria.id(req);
    if (typeof result === 'object') {
        res.status(200).send(result)
    } else {
        res.status(500).send(result)
    }
})

router.post("/", async function (req, res) {
    const result = await categoria.add(req);
    if (result === 'insert') {
        res.status(200).send("Se registró correctamente la categoria.");
    } else {
        res.status(500).send(result);
    }
});

router.put("/", async function (req, res) {
    const result = await categoria.edit(req);
    if (result === 'update') {
        res.status(200).send("Se actualizó correctamente la categoria.");
    } else {
        res.status(500).send(result);
    }
});

router.delete('/', async function (req, res) {
    const result = await categoria.delete(req);
    if (result === 'delete') {
        res.status(200).send("Se eliminó correctamente la categoria.");
    } else {
        res.status(500).send(result);
    }
});

router.get('/combo', async function (req, res) {
    const result = await categoria.combo(req);
    if (Array.isArray(result)) {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});


module.exports = router;