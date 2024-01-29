const express = require('express');
const router = express.Router();
const vehiculo = require('../services/Vehiculo');

router.get('/list', async function (req, res) {
    return await vehiculo.list(req, res);
});

router.post('/add', async function (req, res) {
    return await vehiculo.add(req, res);
});

router.get('/id', async function (req, res) {
    return await vehiculo.id(req, res);
});

router.post('/edit', async function (req, res) {
    return await vehiculo.edit(req, res);
});

router.delete('/', async function (req, res) {
    return await vehiculo.delete(req, res);
});

router.get('/combo', async function (req, res) {
    return await vehiculo.combo(req, res);
});

router.get('/filter', async function (req, res) {
    return await vehiculo.filter(req, res);
});

module.exports = router;