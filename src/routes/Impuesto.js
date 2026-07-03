const express = require('express');
const router = express.Router();
const impuesto = require('../services/Impuesto');

router.get('/list', async function (req, res) {
    return await impuesto.list(req, res);
});

router.post('/add', async function (req, res) {
    return await impuesto.add(req, res);
});

router.get('/id', async function (req, res) {
    return await impuesto.id(req, res);
});

router.post('/edit', async function (req, res) {
    return await impuesto.edit(req, res);
});

router.delete('/', async function (req, res) {
    return await impuesto.delete(req, res);
});

router.get('/combo', async function (req, res) {
    return await impuesto.combo(req, res);
});


module.exports = router;