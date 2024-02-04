const express = require('express');
const router = express.Router();

const Banco = require('../services/Banco');

const banco = new Banco();

router.get('/list', async function (req, res) {
    const result = await banco.list(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.post('/', async function (req, res) {
    const result = await banco.add(req)
    if (result === 'insert') {
        res.status(201).send("Se registró correctamente el banco.");
    } else {
        res.status(500).send(result);
    }
});

router.get('/id', async function (req, res) {
    const result = await banco.id(req)
    if (typeof result === 'object') {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});

router.put('/', async function (req, res) {
    const result = await banco.update(req)
    if (result === 'update') {
        res.status(201).send("Se actualizó correctamente el banco.");
    } else {
        res.status(500).send(result);
    }
});

router.delete('/', async function (req, res) {   
    const result = await banco.delete(req)
    if (result === 'delete') {
        res.status(201).send("Se eliminó correctamente el banco.");
    } else {
        res.status(500).send(result);
    }
});

router.get('/combo', async function (req, res) {
    const result = await banco.combo(req)
    if (Array.isArray(result)) {
        res.status(200).send(result);
    } else {
        res.status(500).send(result);
    }
});


router.get('/detail', async function (req, res) {
    const result = await banco.detail(req)
    if (typeof result === 'object') {
        res.status(200).send(result)
    } else {
        res.status(500).send(result)
    }
});

router.get('/detail/list', async function (req, res) {
    const result = await banco.detailList(req)
    if (typeof result === 'object') {
        res.status(200).send(result)
    } else {
        res.status(500).send(result)
    }
});

module.exports = router;